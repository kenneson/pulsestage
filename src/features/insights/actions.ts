"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadSessionAnalytics } from "@/lib/data/analytics";
import { getAIProvider } from "@/lib/ai";
import { buildInsightInput } from "@/lib/ai/build-input";
import { AIProviderError } from "@/lib/ai/types";
import type { InsightOutput } from "@/lib/ai/schema";
import type { Database } from "@/lib/supabase/database.types";
import { fail, isUuid, ok, type ActionResult } from "@/lib/action-result";

type InsightInsert = Database["public"]["Tables"]["insights"]["Insert"];

const MIN_INTERVAL_MS = 60_000;

export async function generateInsightsAction(sessionId: string): Promise<ActionResult<{ generationId: string }>> {
  if (!isUuid(sessionId)) return fail("Sessão inválida.");

  const provider = getAIProvider();
  if (!provider) return fail("A IA não está configurada. Defina AI_PROVIDER e AI_API_KEY.", "not_configured");

  const supabase = await createClient();
  const data = await loadSessionAnalytics(supabase, sessionId);
  if (!data) return fail("Sessão não encontrada.");
  if (data.session.status !== "completed") return fail("Gere insights depois de encerrar a sessão.");
  if (data.responses.length === 0 && data.feedback.length === 0) {
    return fail("Ainda não há respostas nem feedback para analisar.");
  }

  const last = data.latestInsights[0];
  if (last && Date.now() - Date.parse(last.created_at) < MIN_INTERVAL_MS) {
    return fail("Aguarde um minuto antes de gerar novamente.");
  }

  const options = data.interactionsWithOptions.flatMap((i) => i.options);
  let output: InsightOutput;
  try {
    output = await provider.generateInsights(buildInsightInput(data, options));
  } catch (error) {
    return fail(error instanceof AIProviderError ? error.message : "Falha ao gerar insights.");
  }

  const generationId = randomUUID();
  const base = { session_id: sessionId, generation_id: generationId, provider: provider.name, model: provider.model };
  const confidence = output.data_quality.confidence;

  const rows: InsightInsert[] = [
    { ...base, type: "summary", title: "Resumo", description: output.summary, confidence },
    { ...base, type: "data_quality", title: "Qualidade dos dados", description: output.data_quality.note, confidence },
    ...output.strengths.map(
      (s): InsightInsert => ({
        ...base,
        type: "strength",
        title: s.title,
        description: s.description,
        evidence: s.evidence,
        confidence,
      }),
    ),
    ...output.attention_points.map(
      (a): InsightInsert => ({
        ...base,
        type: "attention_point",
        title: a.title,
        description: a.description,
        evidence: a.evidence,
        confidence,
      }),
    ),
    ...output.recommendations.map(
      (r): InsightInsert => ({
        ...base,
        type: "recommendation",
        title: r.title,
        description: r.description,
        recommendation: r.description,
        priority: r.priority,
        confidence,
      }),
    ),
  ];

  const { error } = await supabase.from("insights").insert(rows);
  if (error) return fail("Não foi possível salvar os insights.");

  revalidatePath(`/dashboard/sessions/${sessionId}/analytics`);
  return ok({ generationId });
}
