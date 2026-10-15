import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/supabase/errors";
import { generateJoinCode } from "@/lib/domain/session";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import type { Locale } from "@/lib/domain/locale";

// Criação de sessão compartilhada pelo painel e pelo MCP (cliente já autenticado; RLS garante o dono).
// Erros saem como chaves da área "errors" (core.*): quem chama traduz com getMessageTranslator().

export type NewSession = {
  speakerId: string;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  duration: number | null;
  joinCode: string | null;
  surveyTemplateId: string | null;
  /** Idioma do telão, do celular da plateia, do filtro de palavrões e da IA. */
  locale: Locale;
};

/** O modelo precisa ser visível ao speaker (RLS: da plataforma ou dele). */
export async function isVisibleTemplate(supabase: ServerSupabase, id: string | null): Promise<boolean> {
  if (!id) return true;
  const { data } = await supabase.from("survey_templates").select("id").eq("id", id).maybeSingle();
  return data !== null;
}

/** Insere a sessão; sem código escolhido, sorteia um até achar um livre. */
export async function insertSession(
  supabase: ServerSupabase,
  values: NewSession,
): Promise<ActionResult<{ id: string; joinCode: string }>> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const joinCode = values.joinCode ?? generateJoinCode();
    const result = await supabase
      .from("sessions")
      .insert({
        speaker_id: values.speakerId,
        title: values.title,
        description: values.description,
        scheduled_at: values.scheduledAt,
        estimated_duration_minutes: values.duration,
        join_code: joinCode,
        survey_template_id: values.surveyTemplateId,
        locale: values.locale,
      })
      .select("id, join_code")
      .single();

    if (!result.error) return ok({ id: result.data.id, joinCode: result.data.join_code });
    if (!isUniqueViolation(result.error)) return fail("core.sessionCreateFailed");
    if (values.joinCode) return fail("core.joinCodeTaken", "join_code_taken");
  }
  return fail("core.joinCodeExhausted");
}
