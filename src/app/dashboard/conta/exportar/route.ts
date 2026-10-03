import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

// Exporta tudo o que pertence ao speaker logado (LGPD: direito de acesso e portabilidade).
// Usa o cliente com RLS: só sai o que ele já pode ver.

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [profile, sessions, templates] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("sessions").select("*").order("created_at"),
    supabase.from("survey_templates").select("*, survey_template_questions(*)").eq("owner_id", user.id),
  ]);
  const ids = (sessions.data ?? []).map((s) => s.id);
  const all = <T,>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) =>
    ids.length === 0 ? Promise.resolve([] as T[]) : fetchAllRows(page);

  const [interactions, participants, responses, surveys, surveyQuestions, surveyResponses, insights] = await Promise.all([
    all((f, t) => supabase.from("interactions").select("*, interaction_options(*)").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("participants").select("*, participant_contacts(*)").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("responses").select("*").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("session_surveys").select("*").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("session_survey_questions").select("*").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("survey_responses").select("*, survey_answers(*)").in("session_id", ids).range(f, t)),
    all((f, t) => supabase.from("insights").select("*").in("session_id", ids).range(f, t)),
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
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pulsestage-meus-dados-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
