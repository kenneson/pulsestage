"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { loadSessionAnalytics } from "@/lib/data/analytics";
import { aiConfigProblem, generateInsights, getAIProvider } from "@/lib/ai";
import { buildInsightInput } from "@/lib/ai/build-input";
import { AIProviderError } from "@/lib/ai/types";
import type { InsightOutput } from "@/lib/ai/schema";
import type { Database } from "@/lib/supabase/database.types";
import { fail, isUuid, ok, type ActionResult } from "@/lib/action-result";

type InsightInsert = Database["public"]["Tables"]["insights"]["Insert"];

const MIN_INTERVAL_MS = 60_000;

export async function generateInsightsAction(sessionId: string): Promise<ActionResult<{ generationId: string }>> {
  const [t, tInsights, locale] = await Promise.all([
    getTranslations("analytics.errors"),
    getTranslations("analytics.insights"),
    getLocale(),
  ]);
  if (!isUuid(sessionId)) return fail(t("invalidSession"));

  const provider = getAIProvider();
  if (!provider) {
    // O diagnóstico de aiConfigProblem() é escrito em português: só acompanha a mensagem no painel em português.
    const detail = locale === "pt-BR" ? (aiConfigProblem() ?? "") : "";
    return fail(`${t("notConfigured")} ${detail}`.trim(), "not_configured");
  }

  const supabase = await createClient();
  const data = await loadSessionAnalytics(supabase, sessionId);
  if (!data) return fail(t("notFound"));
  if (data.session.status !== "completed") return fail(t("notCompleted"));
  if (data.responses.length === 0 && data.survey.responseCount === 0) {
    return fail(t("noData"));
  }

  const last = data.latestInsights[0];
  if (last && Date.now() - Date.parse(last.created_at) < MIN_INTERVAL_MS) {
    return fail(t("tooSoon"));
  }

  const options = data.interactionsWithOptions.flatMap((i) => i.options);
  let output: InsightOutput;
  try {
    output = await generateInsights(provider, buildInsightInput(data, options), locale);
  } catch (error) {
    // A mensagem do provedor vem em português e com detalhes técnicos: o painel mostra uma genérica no idioma dele.
    return fail(error instanceof AIProviderError ? t("aiFailed") : t("generateFailed"));
  }

  const generationId = randomUUID();
  // evidence vai em todas as linhas: num insert em lote, a coluna ausente vira NULL (não o default) e viola o not null.
  const base = {
    session_id: sessionId,
    generation_id: generationId,
    provider: provider.name,
    model: provider.model,
    evidence: [] as string[],
  };
  const confidence = output.data_quality.confidence;

  const rows: InsightInsert[] = [
    { ...base, type: "summary", title: tInsights("summaryTitle"), description: output.summary, confidence },
    { ...base, type: "data_quality", title: tInsights("dataQualityTitle"), description: output.data_quality.note, confidence },
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
  if (error) return fail(t("saveFailed"));

  revalidatePath(`/dashboard/sessions/${sessionId}/analytics`);
  return ok({ generationId });
}
