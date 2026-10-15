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
import { insertSession, isVisibleTemplate } from "./core";
import { LOCALES, type Locale } from "@/lib/domain/locale";
import { getMessageTranslator } from "@/i18n/server";
import {
  canTransition,
  isSessionStatus,
  JOIN_CODE_REGEX,
  normalizeJoinCode,
  toSessionStatus,
  type SessionStatus,
} from "@/lib/domain/session";
import { fail, firstIssue, formValues, isUuid, ok, type ActionResult } from "@/lib/action-result";

export type SessionFormState = { error?: string; success?: string };

const FIELDS = ["title", "description", "date", "time", "duration", "joinCode", "surveyTemplateId", "locale"] as const;

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
});

type SessionValues = {
  title: string;
  description: string | null;
  scheduledAt: string | null;
  duration: number | null;
  joinCode: string | null;
  surveyTemplateId: string | null;
  locale: Locale | null;
};

/** Erros saem como chave de tradução (traduzidos por quem chama). */
function parseSessionForm(
  formData: FormData,
  timeZone: string,
): { ok: true; values: SessionValues } | { ok: false; error: string } {
  const parsed = sessionFormSchema.safeParse(formValues(formData, FIELDS));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { title, description, date, time, duration, joinCode, surveyTemplateId, locale } = parsed.data;

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
    },
  };
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

  const created = await insertSession(supabase, { speakerId: user.id, ...values, locale: values.locale ?? profile.locale });
  if (!created.ok) return { error: tr.message(created.error) };
  const createdId = created.data.id;

  revalidatePath("/dashboard");
  redirect(`/dashboard/sessions/${createdId}`);
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
  const surveyEditable = session.status !== "completed";

  const codeChanged = values.joinCode !== null && values.joinCode !== session.join_code;
  if (codeChanged && session.status !== "draft") {
    return { error: t("joinCodeLocked") };
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      title: values.title,
      description: values.description,
      scheduled_at: values.scheduledAt,
      estimated_duration_minutes: values.duration,
      ...(values.locale ? { locale: values.locale } : {}),
      ...(codeChanged && values.joinCode ? { join_code: values.joinCode } : {}),
      ...(surveyEditable ? { survey_template_id: values.surveyTemplateId } : {}),
    })
    .eq("id", sessionId);

  if (error) {
    return { error: isUniqueViolation(error) ? t("joinCodeTaken") : (await getTranslations("errors"))("saveFailed") };
  }

  revalidatePath(`/dashboard/sessions/${sessionId}`);
  revalidatePath("/dashboard/sessions");
  return { success: (await getTranslations("session.form"))("saved") };
}

export async function deleteSessionAction(sessionId: string): Promise<ActionResult> {
  const t = await getTranslations("session.errors");
  if (!isUuid(sessionId)) return fail(t("invalidSession"));
  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail(t("sessionNotFound"));
  const images = await optionImagesOf(supabase, { sessionId });
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) return fail(t("deleteFailed"));
  // Slides e imagens das alternativas ficam no Storage, fora do cascade do banco.
  await removeSlideFiles(supabase, `${session.speaker_id}/${sessionId}`);
  await removeUnusedOptionImages(supabase, images);
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
