"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSurveyTemplate } from "@/lib/data/surveys";
import { draftToRows, questionToDraft, templateDraftSchema } from "@/lib/domain/survey";
import { fail, firstIssue, isUuid, ok, type ActionResult } from "@/lib/action-result";

const MAX_TEMPLATES_PER_SPEAKER = 50;

async function currentUserId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Cria (templateId null) ou atualiza um modelo do speaker. `payload` é o rascunho do editor em JSON. */
export async function saveSurveyTemplateAction(
  templateId: string | null,
  payload: string,
): Promise<ActionResult<{ id: string }>> {
  if (templateId !== null && !isUuid(templateId)) return fail("Modelo inválido.");
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return fail("Dados inválidos.");
  }
  const parsed = templateDraftSchema.safeParse(json);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const draft = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("Entre novamente.");

  let id = templateId;
  if (id === null) {
    const { count } = await supabase
      .from("survey_templates")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);
    if ((count ?? 0) >= MAX_TEMPLATES_PER_SPEAKER) return fail(`Limite de ${MAX_TEMPLATES_PER_SPEAKER} modelos atingido.`);
    const created = await supabase
      .from("survey_templates")
      .insert({ owner_id: userId, name: draft.name, description: draft.description || null })
      .select("id")
      .single();
    if (created.error) return fail("Não foi possível criar o modelo.");
    id = created.data.id;
  } else {
    const existing = await getSurveyTemplate(supabase, id);
    if (!existing || existing.owner_id !== userId) return fail("Modelo não encontrado.");
    const updated = await supabase
      .from("survey_templates")
      .update({ name: draft.name, description: draft.description || null })
      .eq("id", id);
    if (updated.error) return fail("Não foi possível salvar o modelo.");
  }

  // Troca as perguntas. Sem transação no cliente: se a inserção falhar, restaura as antigas.
  const previous = await supabase.from("survey_template_questions").select("*").eq("template_id", id);
  const removed = await supabase.from("survey_template_questions").delete().eq("template_id", id);
  if (previous.error || removed.error) return fail("Não foi possível salvar as perguntas.");
  const inserted = await supabase
    .from("survey_template_questions")
    .insert(draftToRows(draft).map((row) => ({ ...row, template_id: id })));
  if (inserted.error) {
    if (previous.data.length > 0) await supabase.from("survey_template_questions").insert(previous.data);
    return fail("Não foi possível salvar as perguntas.");
  }

  revalidatePath("/dashboard/pesquisas");
  return ok({ id });
}

/** Copia um modelo (da plataforma ou próprio) para os modelos do speaker e abre o editor. */
export async function duplicateSurveyTemplateAction(templateId: string): Promise<ActionResult> {
  if (!isUuid(templateId)) return fail("Modelo inválido.");
  const supabase = await createClient();
  const source = await getSurveyTemplate(supabase, templateId);
  if (!source) return fail("Modelo não encontrado.");

  const result = await saveSurveyTemplateAction(
    null,
    JSON.stringify({
      name: `${source.name} (cópia)`.slice(0, 120),
      description: source.description ?? undefined,
      questions: source.questions.map(questionToDraft),
    }),
  );
  if (!result.ok) return result;
  redirect(`/dashboard/pesquisas/${result.data.id}`);
}

export async function deleteSurveyTemplateAction(templateId: string): Promise<ActionResult> {
  if (!isUuid(templateId)) return fail("Modelo inválido.");
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("Entre novamente.");
  // Sessões que usavam o modelo voltam ao padrão (on delete set null); as já encerradas guardam a cópia.
  const { error } = await supabase.from("survey_templates").delete().eq("id", templateId).eq("owner_id", userId);
  if (error) return fail("Não foi possível excluir o modelo.");
  revalidatePath("/dashboard/pesquisas");
  return ok(null);
}
