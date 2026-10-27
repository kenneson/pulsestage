"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { optionImagesOf, removeUnusedOptionImages } from "@/lib/data/option-images";
import { removeSlideFiles } from "@/lib/data/slides";
import { getOwnedSession } from "@/lib/data/sessions";
import { getSpeakerProfile } from "@/lib/data/profile";
import { hasDbErrorCode, isUniqueViolation } from "@/lib/supabase/errors";
import { zonedToUtcIso } from "@/lib/datetime";
import { insertSession, isVisibleTemplate, SESSION_PACES, type SessionPace } from "./core";
import { cloneSession } from "@/features/library/core";
import { LOCALES, type Locale } from "@/lib/domain/locale";
import { getMessageTranslator } from "@/i18n/server";
import { isSessionStep, stepHref } from "@/lib/domain/session-steps";
import {
  canTransition,
  isEditable,
  isSessionStatus,
  JOIN_CODE_REGEX,
  normalizeJoinCode,
  toSessionStatus,
  type SessionStatus,
} from "@/lib/domain/session";
import { fail, firstIssue, formValues, isUuid, ok, type ActionResult } from "@/lib/action-result";

export type SessionFormState = { error?: string; success?: string };

const FIELDS = [
  "title",
  "description",
  "date",
  "time",
  "duration",
  "joinCode",
  "surveyTemplateId",
  "locale",
  "pace",
  "useBrand",
  "useBrandShown",
] as const;

// Mensagens são chaves de tradução completas; quem devolve o erro traduz com getMessageTranslator().
const sessionFormSchema = z.object({
  title: z
    .string({ error: "session.errors.titleRequired" })
    .trim()
    .min(1, "session.errors.titleRequired")
    .max(200, "session.errors.titleTooLong"),
  description: z.string().trim().max(2000, "session.errors.descriptionTooLong").optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  duration: z.coerce
    .number({ error: "session.errors.invalidDuration" })
    .int("session.errors.invalidDuration")
    .min(1, "session.errors.invalidDuration")
    .max(1440, "session.errors.invalidDuration")
    .optional(),
  joinCode: z.string().optional(),
  surveyTemplateId: z.uuid({ error: "session.errors.invalidSurveyTemplate" }).optional(),
  locale: z.enum(LOCALES).optional(),
  pace: z.enum(SESSION_PACES).optional(),
  // Caixa de marcar: só vem marcada; `useBrandShown` diz que a opção estava na tela (desmarcada = false).
  useBrand: z.literal("on").optional(),
  useBrandShown: z.literal("1").optional(),
});

type SessionValues = {
  title: string;
  description: string | null;
  scheduledAt: string | null;
  duration: number | null;
  joinCode: string | null;
  surveyTemplateId: string | null;
  locale: Locale | null;
  pace: SessionPace | null;
  /** null = a opção não estava no formulário (não muda) */
  useBrand: boolean | null;
};

/** Erros saem como chave de tradução (traduzidos por quem chama). */
function parseSessionForm(
  formData: FormData,
  timeZone: string,
): { ok: true; values: SessionValues } | { ok: false; error: string } {
  const parsed = sessionFormSchema.safeParse(formValues(formData, FIELDS));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { title, description, date, time, duration, joinCode, surveyTemplateId, locale, pace, useBrand, useBrandShown } =
    parsed.data;

  let scheduledAt: string | null = null;
  if (date) {
    scheduledAt = zonedToUtcIso(date, time ?? "00:00", timeZone);
    if (!scheduledAt) return { ok: false, error: "session.errors.invalidDateTime" };
  }

  let code: string | null = null;
  if (joinCode) {
    code = normalizeJoinCode(joinCode);
    if (!JOIN_CODE_REGEX.test(code)) {
      return { ok: false, error: "session.errors.invalidJoinCode" };
    }
  }

  return {
    ok: true,
    values: {
      title,
      description: description ?? null,
      scheduledAt,
      duration: duration ?? null,
      joinCode: code,
      surveyTemplateId: surveyTemplateId ?? null,
      locale: locale ?? null,
      pace: pace ?? null,
      useBrand: useBrandShown ? useBrand === "on" : null,
    },
  };
}

/** Modelo pronto equivalente (mesmo slug) em outro idioma; null se o modelo for do palestrante ou não houver. */
async function sameTemplateIn(supabase: Awaited<ReturnType<typeof createClient>>, templateId: string, locale: Locale) {
  const { data: current } = await supabase.from("survey_templates").select("owner_id, slug").eq("id", templateId).maybeSingle();
  if (!current || current.owner_id !== null || !current.slug) return null;
  const { data: same } = await supabase
    .from("survey_templates")
    .select("id")
    .is("owner_id", null)
    .eq("slug", current.slug)
    .eq("locale", locale)
    .maybeSingle();
  return same?.id ?? null;
}

export async function createSessionAction(_prev: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const profile = await getSpeakerProfile();
  const tr = await getMessageTranslator();
  const parsed = parseSessionForm(formData, profile.timeZone);
  if (!parsed.ok) return { error: tr.message(parsed.error) };
  const { values } = parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isVisibleTemplate(supabase, values.surveyTemplateId))) {
    return { error: tr.message("session.errors.invalidSurveyTemplate") };
  }

  const created = await insertSession(supabase, {
    speakerId: user.id,
    ...values,
    locale: values.locale ?? profile.locale,
    pace: values.pace ?? undefined,
    useBrand: values.useBrand ?? undefined,
  });
  if (!created.ok) return { error: tr.message(created.error) };
  const createdId = created.data.id;

  revalidatePath("/dashboard");
  // Configurações feitas: a montagem segue no passo 2 (Slides).
  redirect(stepHref(createdId, "slides"));
}

export async function updateSessionAction(
  sessionId: string,
  _prev: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const t = await getTranslations("session.errors");
  if (!isUuid(sessionId)) return { error: t("invalidSession") };
  const parsed = parseSessionForm(formData, (await getSpeakerProfile()).timeZone);
  if (!parsed.ok) return { error: (await getMessageTranslator()).message(parsed.error) };
  const { values } = parsed;

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return { error: t("sessionNotFound") };

  if (!(await isVisibleTemplate(supabase, values.surveyTemplateId))) return { error: t("invalidSurveyTemplate") };
  // Depois de encerrada, a sessão já tem a cópia das perguntas: trocar o modelo não teria efeito.
  const surveyEditable = isEditable(session.status);

  const codeChanged = values.joinCode !== null && values.joinCode !== session.join_code;
  if (codeChanged && session.status !== "draft") {
    return { error: t("joinCodeLocked") };
  }

  // Idioma trocado com um modelo pronto: passa para o mesmo modelo no novo idioma (como na criação).
  let surveyTemplateId = values.surveyTemplateId;
  if (!surveyTemplateId && surveyEditable && values.locale && values.locale !== session.locale && session.survey_template_id) {
    surveyTemplateId = await sameTemplateIn(supabase, session.survey_template_id, values.locale);
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      title: values.title,
      description: values.description,
      scheduled_at: values.scheduledAt,
      estimated_duration_minutes: values.duration,
      ...(values.locale ? { locale: values.locale } : {}),
      ...(values.pace ? { pace: values.pace } : {}),
      ...(values.useBrand !== null ? { use_brand: values.useBrand } : {}),
      ...(codeChanged && values.joinCode ? { join_code: values.joinCode } : {}),
      ...(surveyEditable && surveyTemplateId ? { survey_template_id: surveyTemplateId } : {}),
    })
    .eq("id", sessionId);

  if (error) {
    return { error: isUniqueViolation(error) ? t("joinCodeTaken") : (await getTranslations("errors"))("saveFailed") };
  }

  revalidatePath(`/dashboard/sessions/${sessionId}`);
  revalidatePath("/dashboard/sessions");
  // "Próximo: …" no passo de configurações salva e segue para o passo pedido.
  const continueTo = formData.get("continueTo");
  if (isSessionStep(continueTo)) redirect(stepHref(sessionId, continueTo));
  return { success: (await getTranslations("session.form"))("saved") };
}

/** Passo "Pesquisa pós-evento": troca o modelo da sessão (antes de encerrar; depois, a cópia já foi feita). */
export async function setSurveyTemplateAction(sessionId: string, templateId: unknown): Promise<ActionResult> {
  const t = await getTranslations("session.errors");
  const parsed = z.uuid().safeParse(templateId);
  if (!isUuid(sessionId) || !parsed.success) return fail(t("invalidSurveyTemplate"));
  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(t("sessionNotFound"));
  if (!isEditable(session.status)) return fail((await getMessageTranslator()).message("session.errors.surveyLocked"));
  if (!(await isVisibleTemplate(supabase, parsed.data))) return fail(t("invalidSurveyTemplate"));
  const { error } = await supabase.from("sessions").update({ survey_template_id: parsed.data }).eq("id", sessionId);
  if (error) return fail((await getTranslations("errors"))("saveFailed"));
  revalidatePath(`/dashboard/sessions/${sessionId}`);
  return ok(null);
}

export async function deleteSessionAction(sessionId: string): Promise<ActionResult> {
  const t = await getTranslations("session.errors");
  if (!isUuid(sessionId)) return fail(t("invalidSession"));
  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(t("sessionNotFound"));
  // Slides e imagens das alternativas ficam no Storage, fora do cascade do banco.
  if (!(await removeSessionWithFiles(supabase, session))) return fail(t("deleteFailed"));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sessions");
  return ok(null);
}

export async function setSessionStatusAction(
  sessionId: string,
  status: SessionStatus,
): Promise<ActionResult<{ status: SessionStatus }>> {
  const t = await getTranslations("session.errors");
  if (!isUuid(sessionId) || !isSessionStatus(status)) return fail((await getTranslations("errors"))("invalidData"));

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(t("sessionNotFound"));

  const current = toSessionStatus(session.status);
  if (current === status) return ok({ status });
  if (!canTransition(current, status)) return fail(t("statusNotAllowed"));

  const { error } = await supabase.from("sessions").update({ status }).eq("id", sessionId);
  if (error) {
    return fail(
      hasDbErrorCode(error, "invalid_status_transition") ? t("statusNotAllowed") : t("updateFailed"),
    );
  }

  revalidatePath(`/dashboard/sessions/${sessionId}`, "layout");
  revalidatePath("/dashboard");
  return ok({ status });
}

/** Apaga uma sessão e os arquivos dela no Storage (slides e imagens que nenhuma outra alternativa usa). */
async function removeSessionWithFiles(supabase: Awaited<ReturnType<typeof createClient>>, session: { id: string; speaker_id: string }) {
  const images = await optionImagesOf(supabase, { sessionId: session.id });
  const { error } = await supabase.from("sessions").delete().eq("id", session.id);
  if (error) return false;
  await removeSlideFiles(supabase, `${session.speaker_id}/${session.id}`);
  await removeUnusedOptionImages(supabase, images);
  return true;
}

/**
 * "Testar sessão": cria um ensaio (cópia oculta, com as mesmas perguntas, slides e prêmios), já ao vivo.
 * O ensaio não aparece em listas, estatísticas nem no perfil público; um ensaio anterior da mesma
 * sessão é apagado. Devolve o id do ensaio (a tela abre a sala ao vivo dele).
 */
export async function startRehearsalAction(sessionId: string): Promise<ActionResult<{ id: string }>> {
  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("session.rehearsal")]);
  if (!isUuid(sessionId)) return fail(tr.message("errors.invalidData"));
  const supabase = await createClient();
  const source = await getOwnedSession(supabase, sessionId);
  if (!source) return fail(t("errors.notFound"));
  if (source.is_test) return fail(t("errors.alreadyRehearsal"));
  if (!isEditable(source.status)) return fail(t("errors.ended"));

  const { data: previous } = await supabase.from("sessions").select("id, speaker_id").eq("rehearsal_of", source.id);
  for (const old of previous ?? []) await removeSessionWithFiles(supabase, old);

  const cloned = await cloneSession(supabase, source, {
    title: t("title", { title: source.title }).slice(0, 200),
    scheduledAt: null,
    rehearsalOf: source.id,
  });
  if (!cloned.ok) return fail(tr.message(cloned.error));

  const { error } = await supabase.from("sessions").update({ status: "live" }).eq("id", cloned.data.id);
  if (error) return fail(t("errors.startFailed"));
  return ok({ id: cloned.data.id });
}

/** Encerra o ensaio: apaga a sessão de teste (respostas e arquivos) e volta para a sessão original. */
export async function endRehearsalAction(rehearsalId: string): Promise<ActionResult<{ sourceId: string | null }>> {
  const [tr, t] = await Promise.all([getMessageTranslator(), getTranslations("session.rehearsal")]);
  if (!isUuid(rehearsalId)) return fail(tr.message("errors.invalidData"));
  const supabase = await createClient();
  const session = await getOwnedSession(supabase, rehearsalId);
  if (!session || !session.is_test) return fail(t("errors.notFound"));
  if (!(await removeSessionWithFiles(supabase, session))) return fail(t("errors.endFailed"));
  if (session.rehearsal_of) revalidatePath(`/dashboard/sessions/${session.rehearsal_of}`);
  return ok({ sourceId: session.rehearsal_of });
}
