import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { loadSessionAnalytics } from "@/lib/data/analytics";
import { getSpeakerProfile } from "@/lib/data/profile";
import { isInteractionType, isScoredType, normalizeSettings } from "@/lib/domain/interactions";
import { readableAnswer } from "@/lib/domain/interaction-summary";
import { parseQuizValue, participantLabel } from "@/lib/domain/metrics";
import { csvFileName, toCsv, type CsvCell } from "@/lib/domain/csv";
import { isUuid } from "@/lib/action-result";

// Exportação CSV do analytics (RLS: só o dono da sessão).
//   ?tipo=interacoes  respostas às perguntas ao vivo, uma linha por resposta
//   ?tipo=pesquisa    pesquisa pós-evento, uma linha por pesquisa e uma coluna por pergunta

function localTime(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function csvResponse(body: string, fileName: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = request.nextUrl.searchParams.get("tipo");
  // Idioma da requisição (o do painel de quem exporta).
  const t = await getTranslations("analytics.export");
  const tDomain = await getTranslations("domain");
  if (!isUuid(id) || (kind !== "interacoes" && kind !== "pesquisa")) {
    return NextResponse.json({ error: t("errors.invalidParams") }, { status: 400 });
  }

  const supabase = await createClient();
  const [data, profile] = await Promise.all([loadSessionAnalytics(supabase, id), getSpeakerProfile()]);
  if (!data) return NextResponse.json({ error: t("errors.notFound") }, { status: 404 });
  const tz = profile.timeZone;
  const people = new Map(data.participants.map((p) => [p.id, p]));
  const anonymousParticipant = tDomain("anonymousParticipant");
  // Excel em inglês americano espera "," e ponto decimal; em português e espanhol, ";" e vírgula.
  const us = (await getLocale()) === "en-US";
  const labels = { yes: tDomain("yes"), no: tDomain("no"), separator: us ? "," : ";", decimal: us ? "." : "," } as const;

  if (kind === "interacoes") {
    const interactions = new Map(data.interactionsWithOptions.map((i) => [i.id, i]));
    const order = new Map(data.interactionsWithOptions.map((i, index) => [i.id, index + 1]));
    const rows: CsvCell[][] = [...data.responses]
      .sort((a, b) => (order.get(a.interaction_id) ?? 0) - (order.get(b.interaction_id) ?? 0) || a.created_at.localeCompare(b.created_at))
      .map((r) => {
        const interaction = interactions.get(r.interaction_id);
        const type = interaction && isInteractionType(interaction.type) ? interaction.type : null;
        // Resposta legível por tipo ("A: 70 · B: 30", "Item (x 80, y 20)", "x 42%, y 18%"…).
        const answer = interaction
          ? readableAnswer(
              interaction.type,
              r.value,
              [...interaction.options].sort((a, b) => a.position - b.position),
              type ? normalizeSettings(type, interaction.settings) : undefined,
              labels.decimal,
            )
          : null;
        // Quiz, quiz de digitar e adivinhe o número: acertou, pontos e tempo (calculados no servidor).
        const quiz = type && isScoredType(type) ? parseQuizValue(r.value) : null;
        return [
          order.get(r.interaction_id) ?? null,
          interaction && isInteractionType(interaction.type) ? tDomain(`interactionTypes.${interaction.type}.label`) : interaction?.type,
          interaction?.title,
          participantLabel(people.get(r.participant_id), r.participant_id, anonymousParticipant),
          answer ?? null,
          quiz ? quiz.isCorrect : null,
          quiz ? quiz.points : null,
          quiz ? Math.round(quiz.responseTimeMs / 100) / 10 : null,
          localTime(r.created_at, tz),
        ];
      });
    const header = [
      t("responses.order"),
      t("responses.type"),
      t("responses.question"),
      t("responses.participant"),
      t("responses.answer"),
      t("responses.correct"),
      t("responses.points"),
      t("responses.time"),
      t("responses.answeredAt"),
    ];
    return csvResponse(toCsv(header, rows, labels), csvFileName(data.session.title, t("fileResponses")));
  }

  const [responses, answers] = await Promise.all([
    fetchAllRows<{ id: string; participant_id: string | null; created_at: string }>((from, to) =>
      supabase.from("survey_responses").select("id, participant_id, created_at").eq("session_id", id).order("created_at").range(from, to),
    ),
    fetchAllRows<{ response_id: string; question_id: string; value_int: number | null; value_text: string | null }>((from, to) =>
      supabase
        .from("survey_answers")
        .select("response_id, question_id, value_int, value_text, survey_responses!inner(session_id)")
        .eq("survey_responses.session_id", id)
        .range(from, to),
    ),
  ]);
  const questions = data.survey.questions;
  const byResponse = new Map<string, Map<string, { value_int: number | null; value_text: string | null }>>();
  for (const a of answers) {
    const map = byResponse.get(a.response_id) ?? new Map();
    map.set(a.question_id, a);
    byResponse.set(a.response_id, map);
  }
  const rows: CsvCell[][] = responses.map((r, index) => {
    const given = byResponse.get(r.id);
    return [
      index + 1,
      localTime(r.created_at, tz),
      r.participant_id ? participantLabel(people.get(r.participant_id), r.participant_id, anonymousParticipant) : tDomain("anonymous"),
      ...questions.map((q) => {
        const a = given?.get(q.id);
        if (!a) return null;
        if (q.kind === "text") return a.value_text;
        if (q.kind === "choice") return a.value_int !== null ? (q.settings.options?.[a.value_int] ?? null) : null;
        return a.value_int;
      }),
    ];
  });
  const header = [t("survey.response"), t("survey.sentAt"), t("survey.participant"), ...questions.map((q) => q.label)];
  return csvResponse(toCsv(header, rows, labels), csvFileName(data.session.title, t("fileSurvey")));
}
