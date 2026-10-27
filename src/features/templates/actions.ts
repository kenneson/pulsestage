"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSpeakerProfile } from "@/lib/data/profile";
import { generalTemplateId, listSurveyTemplates } from "@/lib/data/surveys";
import { insertSession } from "@/features/sessions/core";
import { createInteraction } from "@/features/interactions/core";
import { getMessageTranslator } from "@/i18n/server";
import { interactionInputSchema } from "@/lib/domain/interactions";
import { findSessionTemplate, SESSION_TEMPLATE_IDS, templateInteractions } from "@/lib/domain/session-templates";
import { defaultTeams } from "@/lib/domain/team-settings";
import { fail, type ActionResult } from "@/lib/action-result";

const templateIdSchema = z.enum(SESSION_TEMPLATE_IDS as [string, ...string[]]);

/**
 * Cria uma sessão em rascunho a partir de um modelo (perguntas no idioma do palestrante) e abre o editor.
 * Se alguma parte falhar, a sessão criada é apagada: nada de rascunho pela metade.
 */
export async function createFromTemplateAction(templateId: string): Promise<ActionResult> {
  const t = await getTranslations("templates.errors");
  const parsedId = templateIdSchema.safeParse(templateId);
  const template = parsedId.success ? findSessionTemplate(parsedId.data) : null;
  if (!template) return fail(t("notFound"));

  const profile = await getSpeakerProfile();
  const supabase = await createClient();
  const [tTemplates, tTeams, surveys] = await Promise.all([
    getTranslations({ locale: profile.locale, namespace: "templates" }),
    getTranslations({ locale: profile.locale, namespace: "session.teams.defaults" }),
    listSurveyTemplates(supabase),
  ]);
  // Chaves montadas pelo domínio (o teste confere que todas existem nos três idiomas).
  const text = (key: string) => (tTemplates as unknown as (key: string) => string)(key);

  const inputs = templateInteractions(template, text).map((input) => interactionInputSchema.safeParse(input));
  const invalid = inputs.find((p) => !p.success);
  if (invalid && !invalid.success) {
    return fail((await getMessageTranslator()).issue(invalid.error));
  }

  const surveyTemplateId =
    surveys.find((s) => s.id === profile.defaultSurveyTemplateId)?.id ?? generalTemplateId(surveys, profile.locale);
  const created = await insertSession(supabase, {
    speakerId: profile.id,
    title: text(`items.${template.id}.name`),
    description: text(`items.${template.id}.sessionDescription`),
    scheduledAt: null,
    duration: template.durationMinutes,
    joinCode: null,
    surveyTemplateId,
    locale: profile.locale,
  });
  if (!created.ok) return fail((await getMessageTranslator()).message(created.error));
  const sessionId = created.data.id;

  const rollback = async () => {
    await supabase.from("sessions").delete().eq("id", sessionId);
    return fail(t("createFailed"));
  };

  if (template.pace !== "live" || template.teams) {
    const { error } = await supabase
      .from("sessions")
      .update({ pace: template.pace, teams_enabled: template.teams })
      .eq("id", sessionId);
    if (error) return rollback();
  }
  if (template.teams) {
    const names = [tTeams("red"), tTeams("blue"), tTeams("yellow"), tTeams("green")];
    const { error } = await supabase
      .from("session_teams")
      .insert(defaultTeams(names).map((team) => ({ ...team, session_id: sessionId })));
    if (error) return rollback();
  }
  // Em sequência: cada uma entra no fim do roteiro, na ordem do modelo.
  for (const parsed of inputs) {
    if (!parsed.success) return rollback();
    const result = await createInteraction(supabase, sessionId, parsed.data);
    if (!result.ok) return rollback();
  }

  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/sessions/${sessionId}`);
}
