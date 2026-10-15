import "server-only";
import type { SessionAnalyticsBundle } from "@/lib/data/analytics";
import { computeOverview, quizStats } from "@/lib/domain/metrics";
import { isInteractionType, normalizeSettings, INTERACTION_TYPE_META } from "@/lib/domain/interactions";
import { ratingStats, snapshotFromResponses, wordList } from "@/lib/domain/results";
import { sessionClock, talkSeconds } from "@/lib/domain/timing";
import { rankingResults } from "@/lib/domain/ranking";
import type { SpeakerQuestion } from "@/lib/data/engagement";
import type { ReactionTally } from "@/lib/domain/reactions";

// Resumo dos resultados de uma sessão para o assistente analisar. Só números agregados e textos das
// respostas abertas e da pesquisa; nunca nomes, e-mails ou telefones de quem participou.

const MAX_TEXTS = 30;
const round = (n: number | null, digits = 2) => (n === null ? null : Math.round(n * 10 ** digits) / 10 ** digits);

export function summarizeForAssistant(
  bundle: SessionAnalyticsBundle,
  extras: { questions: SpeakerQuestion[]; reactions: ReactionTally },
) {
  const { session } = bundle;
  const overview = computeOverview(bundle);
  const seconds = talkSeconds(sessionClock(session), Date.now());

  const interactions = bundle.interactionsWithOptions
    .filter((i) => isInteractionType(i.type))
    .map((i) => {
      const type = isInteractionType(i.type) ? i.type : "open_text";
      const responses = bundle.responses.filter((r) => r.interaction_id === i.id);
      const snapshot = snapshotFromResponses(responses);
      const options = [...i.options].sort((a, b) => a.position - b.position);
      const base = { question: i.title, type, type_label: INTERACTION_TYPE_META[type].label, responses: responses.length };
      switch (type) {
        case "multiple_choice":
          return {
            ...base,
            results: options.map((o) => ({ option: o.label, votes: snapshot.counts[o.id] ?? 0 })),
          };
        case "quiz": {
          const stats = quizStats(responses);
          return {
            ...base,
            correct_rate: round(stats.correctRate),
            avg_response_seconds: round(stats.avgResponseMs === null ? null : stats.avgResponseMs / 1000, 1),
            results: options.map((o) => ({ option: o.label, correct: o.is_correct, votes: snapshot.counts[o.id] ?? 0 })),
          };
        }
        case "rating": {
          const settings = normalizeSettings(type, i.settings);
          const stats = ratingStats(settings.min, settings.max, snapshot);
          return {
            ...base,
            scale: `${settings.min} a ${settings.max}`,
            mean: round(stats.mean),
            median: stats.median,
            distribution: Object.fromEntries(
              Array.from({ length: settings.max - settings.min + 1 }, (_, k) => {
                const v = settings.min + k;
                return [String(v), snapshot.counts[String(v)] ?? 0];
              }),
            ),
          };
        }
        case "word_cloud":
          return { ...base, top_words: wordList(snapshot, 20) };
        case "open_text":
          return { ...base, answers: snapshot.recent.slice(0, MAX_TEXTS).map((e) => e.text) };
        case "ranking":
          return {
            ...base,
            ranking: rankingResults(options.map((o) => ({ id: o.id, label: o.label })), snapshot).map((r, index) => ({
              position: index + 1,
              option: r.label,
              average_position: r.averagePosition,
            })),
          };
      }
    });

  const survey = overview.survey;
  const comments = bundle.survey.answers
    .map((a) => a.value_text?.trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, MAX_TEXTS);

  return {
    session: {
      title: session.title,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      talk_minutes: seconds === null ? null : Math.round(seconds / 60),
      planned_minutes: session.estimated_duration_minutes,
    },
    overview: {
      participants: overview.participants,
      people_who_answered: overview.uniqueResponders,
      total_answers: overview.totalResponses,
      response_rate: round(overview.responseRate),
      participation_rate: round(overview.participationRate),
    },
    survey: {
      responses: survey.count,
      overall_score_0_10: round(survey.headline, 1),
      dimensions: survey.dimensions.map((d) => ({ dimension: d.label, mean: round(d.mean), max: d.max, answers: d.count })),
      comments,
    },
    interactions,
    // Perguntas da plateia sem nome de quem perguntou (só o texto, curtidas e se foi respondida).
    audience_questions: extras.questions
      .filter((q) => q.status !== "hidden")
      .sort((a, b) => b.upvotes - a.upvotes)
      .slice(0, 50)
      .map((q) => ({ question: q.body, upvotes: q.upvotes, answered: q.status === "answered" })),
    reactions: extras.reactions,
  };
}
