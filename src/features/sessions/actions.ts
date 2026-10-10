"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { removeSlideFiles } from "@/lib/data/slides";
import { getOwnedSession } from "@/lib/data/sessions";
import { getSpeakerProfile } from "@/lib/data/profile";
import { hasDbErrorCode, isUniqueViolation } from "@/lib/supabase/errors";
import { zonedToUtcIso } from "@/lib/datetime";
import {
  canTransition,
  generateJoinCode,
  isSessionStatus,
  JOIN_CODE_REGEX,
  normalizeJoinCode,
  toSessionStatus,
  type SessionStatus,
} from "@/lib/domain/session";
import { fail, firstIssue, formValues, isUuid, ok, type ActionResult } from "@/lib/action-result";

export type SessionFormState = { error?: string; success?: string };

const FIELDS = ["title", "description", "date", "time", "duration", "joinCode", "surveyTemplateId"] as const;

const sessionFormSchema = z.object({
  title: z.string({ error: "Informe o título." }).trim().min(1, "Informe o título.").max(200, "Título muito longo."),
  description: z.string().trim().max(2000, "Descrição muito longa.").optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  duration: z.coerce.number().int().min(1, "Duração inválida.").max(1440, "Duração inválida.").optional(),
  joinCode: z.string().optional(),
  surveyTemplateId: z.uuid({ error: "Modelo de pesquisa inválido." }).optional(),
});

type SessionValues = {
  title: string;
  description: string | null;
  scheduledAt: string | null;
  duration: number | null;
  joinCode: string | null;
  surveyTemplateId: string | null;
};

function parseSessionForm(
  formData: FormData,
  timeZone: string,
): { ok: true; values: SessionValues } | { ok: false; error: string } {
  const parsed = sessionFormSchema.safeParse(formValues(formData, FIELDS));
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { title, description, date, time, duration, joinCode, surveyTemplateId } = parsed.data;

  let scheduledAt: string | null = null;
  if (date) {
    scheduledAt = zonedToUtcIso(date, time ?? "00:00", timeZone);
    if (!scheduledAt) return { ok: false, error: "Data ou horário inválidos." };
  }

  let code: string | null = null;
  if (joinCode) {
    code = normalizeJoinCode(joinCode);
    if (!JOIN_CODE_REGEX.test(code)) {
      return { ok: false, error: "O código deve ter de 4 a 10 letras ou números." };
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
    },
  };
}

/** O modelo precisa ser visível ao speaker (RLS: da plataforma ou dele). */
async function isVisibleTemplate(supabase: Awaited<ReturnType<typeof createClient>>, id: string | null) {
  if (!id) return true;
  const { data } = await supabase.from("survey_templates").select("id").eq("id", id).maybeSingle();
  return data !== null;
}

export async function createSessionAction(_prev: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const parsed = parseSessionForm(formData, (await getSpeakerProfile()).timeZone);
  if (!parsed.ok) return { error: parsed.error };
  const { values } = parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isVisibleTemplate(supabase, values.surveyTemplateId))) return { error: "Modelo de pesquisa inválido." };

  let createdId: string | null = null;
  for (let attempt = 0; attempt < 4 && !createdId; attempt++) {
    const result = await supabase
      .from("sessions")
      .insert({
        speaker_id: user.id,
        title: values.title,
        description: values.description,
        scheduled_at: values.scheduledAt,
        estimated_duration_minutes: values.duration,
        join_code: values.joinCode ?? generateJoinCode(),
        survey_template_id: values.surveyTemplateId,
      })
      .select("id")
      .single();

    if (!result.error) {
      createdId = result.data.id;
    } else if (isUniqueViolation(result.error)) {
      if (values.joinCode) return { error: "Esse código já está em uso por outra sessão ativa." };
    } else {
      return { error: "Não foi possível criar a sessão." };
    }
  }

  if (!createdId) return { error: "Não foi possível gerar um código único. Tente novamente." };

  revalidatePath("/dashboard");
  redirect(`/dashboard/sessions/${createdId}`);
}

export async function updateSessionAction(
  sessionId: string,
  _prev: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  if (!isUuid(sessionId)) return { error: "Sessão inválida." };
  const parsed = parseSessionForm(formData, (await getSpeakerProfile()).timeZone);
  if (!parsed.ok) return { error: parsed.error };
  const { values } = parsed;

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return { error: "Sessão não encontrada." };

  if (!(await isVisibleTemplate(supabase, values.surveyTemplateId))) return { error: "Modelo de pesquisa inválido." };
  // Depois de encerrada, a sessão já tem a cópia das perguntas: trocar o modelo não teria efeito.
  const surveyEditable = session.status !== "completed";

  const codeChanged = values.joinCode !== null && values.joinCode !== session.join_code;
  if (codeChanged && session.status !== "draft") {
    return { error: "O código só pode ser alterado antes de iniciar a sessão." };
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      title: values.title,
      description: values.description,
      scheduled_at: values.scheduledAt,
      estimated_duration_minutes: values.duration,
      ...(codeChanged && values.joinCode ? { join_code: values.joinCode } : {}),
      ...(surveyEditable ? { survey_template_id: values.surveyTemplateId } : {}),
    })
    .eq("id", sessionId);

  if (error) {
    return { error: isUniqueViolation(error) ? "Esse código já está em uso." : "Não foi possível salvar." };
  }

  revalidatePath(`/dashboard/sessions/${sessionId}`);
  revalidatePath("/dashboard/sessions");
  return { success: "Informações salvas." };
}

export async function deleteSessionAction(sessionId: string): Promise<ActionResult> {
  if (!isUuid(sessionId)) return fail("Sessão inválida.");
  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail("Sessão não encontrada.");
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) return fail("Não foi possível excluir a sessão.");
  // Os slides ficam no Storage, fora do cascade do banco.
  await removeSlideFiles(supabase, `${session.speaker_id}/${sessionId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/sessions");
  return ok(null);
}

export async function setSessionStatusAction(
  sessionId: string,
  status: SessionStatus,
): Promise<ActionResult<{ status: SessionStatus }>> {
  if (!isUuid(sessionId) || !isSessionStatus(status)) return fail("Dados inválidos.");

  const supabase = await createClient();
  const session = await getOwnedSession(supabase, sessionId);
  if (!session) return fail("Sessão não encontrada.");

  const current = toSessionStatus(session.status);
  if (current === status) return ok({ status });
  if (!canTransition(current, status)) return fail("Essa mudança de status não é permitida.");

  const { error } = await supabase.from("sessions").update({ status }).eq("id", sessionId);
  if (error) {
    return fail(
      hasDbErrorCode(error, "invalid_status_transition")
        ? "Essa mudança de status não é permitida."
        : "Não foi possível atualizar a sessão.",
    );
  }

  revalidatePath(`/dashboard/sessions/${sessionId}`, "layout");
  revalidatePath("/dashboard");
  return ok({ status });
}
