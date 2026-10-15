import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

// Exporta tudo o que pertence ao speaker logado (LGPD: direito de acesso e portabilidade).
// Usa o cliente com RLS: só sai o que ele já pode ver.

export async function GET() {
  const t = await getTranslations("account");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t("errors.unauthenticated") }, { status: 401 });

  const [profile, sessions, templates, contacts] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("sessions").select("*").order("created_at"),
    supabase.from("survey_templates").select("*, survey_template_questions(*)").eq("owner_id", user.id),
    fetchAllRows((f, t) => supabase.from("contact_requests").select("*").order("created_at").range(f, t)),
  ]);
  const ids = (sessions.data ?? []).map((s) => s.id);
  const all = <T,>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) =>
    ids.length === 0 ? Promise.resolve([] as T[]) : fetchAllRows(page);

  const [interactions, participants, responses, surveys, surveyQuestions, surveyResponses, insights, prizes, entries, winners, questions, reactions] = await Promise.all([
    all((f, t) => supabase.from("interactions").select("*, interaction_options(*)").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("participants").select("*, participant_contacts(*)").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("responses").select("*").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("session_surveys").select("*").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("session_survey_questions").select("*").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("survey_responses").select("*, survey_answers(*)").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("insights").select("*").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("raffle_prizes").select("*").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("raffle_entries").select("*").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("raffle_winners").select("*").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("audience_questions").select("*, audience_question_votes(count)").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("reactions").select("session_id, kind, created_at").in("session_id", ids).range(f, t)),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    survey_templates: templates.data ?? [],
    sessions: sessions.data ?? [],
    interactions,
    participants,
    responses,
    session_surveys: surveys,
    session_survey_questions: surveyQuestions,
    survey_responses: surveyResponses,
    insights,
    raffle_prizes: prizes,
    raffle_entries: entries,
    raffle_winners: winners,
    contact_requests: contacts,
    audience_questions: questions,
    reactions,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${t("export.fileName", { date })}"`,
      "Cache-Control": "no-store",
    },
  });
}
