"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { getOwnedSession } from "@/lib/data/sessions";
import { hasDbErrorCode } from "@/lib/supabase/errors";
import { hasOptions, interactionInputSchema, type ParsedInteractionInput } from "@/lib/domain/interactions";
import { fail, firstIssue, isUuid, ok, type ActionResult } from "@/lib/action-result";

function revalidateSession(sessionId: string) {
  revalidatePath(`/dashboard/sessions/${sessionId}`, "layout");
}

async function responseCount(supabase: ServerSupabase, interactionId: string): Promise<number> {
  const { count, error } = await supabase
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("interaction_id", interactionId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function optionRows(interactionId: string, input: ParsedInteractionInput) {
  if (!("options" in input)) return [];
  return input.options.map((o, index) => ({
    id: o.id ?? randomUUID(),
    interaction_id: interactionId,
    label: o.label,
    position: index,
    is_correct: input.type === "quiz" ? o.isCorrect : false,
    points: input.type === "quiz" && o.isCorrect ? o.points : 0,
  }));
}

export async function saveInteractionAction(
  sessionId: string,
  interactionId: string | null,
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!isUuid(sessionId) || (interactionId !== null && !isUuid(interactionId))) return fail("Dados inválidos.");

  const parsed = interactionInputSchema.safeParse(rawInput);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const input = parsed.data;

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail("Sessão não encontrada.");
  if (session.status === "completed") return fail("A sessão já foi encerrada.");

  const fields = {
    type: input.type,
    title: input.title,
    description: input.description || null,
    settings: input.settings,
  };

  // ---- Criar --------------------------------------------------------------
  if (interactionId === null) {
    const { data: last, error: lastError } = await supabase
      .from("interactions")
      .select("position")
      .eq("session_id", sessionId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) return fail("Não foi possível criar a interação.");

    const created = await supabase
      .from("interactions")
      .insert({ ...fields, session_id: sessionId, position: last ? last.position + 1 : 0 })
      .select("id")
      .single();
    if (created.error) return fail("Não foi possível criar a interação.");

    const rows = optionRows(created.data.id, input);
    if (rows.length > 0) {
      const { error } = await supabase.from("interaction_options").insert(rows);
      if (error) {
        await supabase.from("interactions").delete().eq("id", created.data.id);
        return fail("Não foi possível salvar as alternativas.");
      }
    }

    revalidateSession(sessionId);
    return ok({ id: created.data.id });
  }

  // ---- Editar -------------------------------------------------------------
  const { data: existing, error: existingError } = await supabase
    .from("interactions")
    .select("*")
    .eq("id", interactionId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existingError || !existing) return fail("Interação não encontrada.");

  const { data: currentOptions, error: optionsError } = await supabase
    .from("interaction_options")
    .select("*")
    .eq("interaction_id", interactionId);
  if (optionsError) return fail("Não foi possível carregar as alternativas.");

  const answered = (await responseCount(supabase, interactionId)) > 0;
  const rows = optionRows(interactionId, input);

  if (answered) {
    // Respostas guardam o id da opção e o acerto: estrutura precisa ficar estável.
    if (existing.type !== input.type) return fail("Já existem respostas: o tipo não pode mudar.");
    const currentIds = new Set(currentOptions.map((o) => o.id));
    const sameSet = rows.length === currentOptions.length && rows.every((r) => currentIds.has(r.id));
    if (!sameSet) return fail("Já existem respostas: edite o texto das alternativas, sem adicionar ou remover.");
    if (input.type === "quiz") {
      const before = currentOptions.find((o) => o.is_correct)?.id;
      const after = rows.find((r) => r.is_correct)?.id;
      if (before !== after) return fail("Já existem respostas: a alternativa correta não pode mudar.");
    }
  }

  const { error: updateError } = await supabase.from("interactions").update(fields).eq("id", interactionId);
  if (updateError) return fail("Não foi possível salvar a interação.");

  const keepIds = new Set(rows.map((r) => r.id));
  const toDelete = currentOptions.filter((o) => !keepIds.has(o.id)).map((o) => o.id);
  if (toDelete.length > 0) {
    const { error } = await supabase.from("interaction_options").delete().in("id", toDelete);
    if (error) return fail("Não foi possível atualizar as alternativas.");
  }
  if (hasOptions(input.type) && rows.length > 0) {
    // Upsert numa única requisição: a constraint de posição é verificada no commit.
    const { error } = await supabase.from("interaction_options").upsert(rows, { onConflict: "id" });
    if (error) return fail("Não foi possível atualizar as alternativas.");
  }

  revalidateSession(sessionId);
  return ok({ id: interactionId });
}

export async function deleteInteractionAction(sessionId: string, interactionId: string): Promise<ActionResult> {
  if (!isUuid(sessionId) || !isUuid(interactionId)) return fail("Dados inválidos.");
  const supabase = await createClient();

  const { data: interaction } = await supabase
    .from("interactions")
    .select("id, is_active")
    .eq("id", interactionId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!interaction) return fail("Interação não encontrada.");
  if (interaction.is_active) return fail("Encerre a interação antes de excluí-la.");

  const { error } = await supabase.from("interactions").delete().eq("id", interactionId);
  if (error) return fail("Não foi possível excluir a interação.");

  revalidateSession(sessionId);
  return ok(null);
}

export async function reorderInteractionsAction(sessionId: string, orderedIds: string[]): Promise<ActionResult> {
  const parsed = z.array(z.uuid()).max(200).safeParse(orderedIds);
  if (!isUuid(sessionId) || !parsed.success) return fail("Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_interactions", { p_session_id: sessionId, p_ids: parsed.data });
  if (error) return fail("Não foi possível reordenar.");

  revalidateSession(sessionId);
  return ok(null);
}

export async function setActiveInteractionAction(
  sessionId: string,
  interactionId: string | null,
): Promise<ActionResult> {
  if (!isUuid(sessionId) || (interactionId !== null && !isUuid(interactionId))) return fail("Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_active_interaction", {
    p_session_id: sessionId,
    ...(interactionId ? { p_interaction_id: interactionId } : {}),
  });

  if (error) {
    if (hasDbErrorCode(error, "session_not_live")) return fail("Inicie ou retome a sessão para ativar interações.");
    if (hasDbErrorCode(error, "interaction_not_found")) return fail("Interação não encontrada.");
    return fail("Não foi possível alterar a interação ativa.");
  }
  return ok(null);
}
