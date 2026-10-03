import {
  computeOverview,
  computePulse,
  confidenceFromSample,
  quizStats,
  type AnalyticsData,
} from "@/lib/domain/metrics";
import { isInteractionType, normalizeSettings, toPublicInteraction } from "@/lib/domain/interactions";
import { optionBars, ratingStats, snapshotFromResponses, wordList } from "@/lib/domain/results";
import type { InteractionOptionRow } from "@/lib/supabase/types";
import { questionResults } from "@/lib/domain/survey";
import type { InsightInput } from "./types";

const MAX_TEXTS = 60;
const MAX_TEXT_LENGTH = 280;

function texts(values: (string | null)[]): string[] {
  return values
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, MAX_TEXTS)
    .map((v) => v.trim().slice(0, MAX_TEXT_LENGTH));
}

function round(value: number | null, digits = 2): number | null {
  return value === null ? null : Number(value.toFixed(digits));
}

/** Monta o input agregado da IA. Não inclui nenhum dado pessoal. */
export function buildInsightInput(data: AnalyticsData, options: readonly InteractionOptionRow[]): InsightInput {
  const pulse = computePulse(data);
  const overview = computeOverview(data, pulse);
  const { survey } = overview;

  const interactions = [...data.interactions]
    .sort((a, b) => a.position - b.position)
    .map((row) => {
      const responses = data.responses.filter((r) => r.interaction_id === row.id);
      const snapshot = snapshotFromResponses(responses);
      const pub = toPublicInteraction(row, options);
      let summary: Record<string, unknown> = {};

      if (pub && isInteractionType(row.type)) {
        switch (pub.type) {
          case "multiple_choice":
            summary = {
              distribution: optionBars(pub.options, snapshot).map((b) => ({ option: b.label, pct: round(b.pct) })),
            };
            break;
          case "quiz": {
            const stats = quizStats(responses);
            summary = {
              correctRate: round(stats.correctRate),
              avgResponseSeconds: stats.avgResponseMs === null ? null : round(stats.avgResponseMs / 1000, 1),
            };
            break;
          }
          case "rating": {
            const settings = normalizeSettings(pub.type, row.settings);
            const stats = ratingStats(settings.min, settings.max, snapshot);
            summary = { scale: `${settings.min}-${settings.max}`, mean: round(stats.mean), median: stats.median };
            break;
          }
          case "word_cloud":
            summary = { topTerms: wordList(snapshot, 15) };
            break;
          case "open_text":
            summary = { answers: texts(snapshot.recent.map((e) => e.text)) };
            break;
        }
      }

      return { position: row.position, type: row.type, title: row.title, responses: responses.length, summary };
    });

  return {
    session: {
      title: data.session.title,
      description: data.session.description,
      durationMinutes: data.session.estimated_duration_minutes,
    },
    sample: {
      participants: overview.participants,
      participantsWhoResponded: overview.uniqueResponders,
      totalResponses: overview.totalResponses,
      surveyResponses: survey.count,
      confidenceHint: confidenceFromSample(survey.count),
    },
    rates: {
      responseRate: round(overview.responseRate),
      participationRate: round(overview.participationRate),
      surveyResponseRate: round(overview.surveyResponseRate),
    },
    participationOverTime: pulse.map((p) => ({
      minute: p.minute,
      interaction: p.title,
      rate: round(p.rate),
      responses: p.responses,
    })),
    interactions,
    survey: {
      name: data.survey.name,
      dimensions: survey.dimensions.map((d) => ({
        dimension: d.label,
        scale: d.kind === "scale" ? "1-5" : "0-10",
        mean: round(d.mean) ?? 0,
        answers: d.count,
      })),
      questions: questionResults(data.survey.questions, data.survey.answers).map((r) => {
        const base = { question: r.question.label, dimension: r.question.dimension, answers: r.count };
        switch (r.kind) {
          case "scale":
            return { ...base, type: "scale_1_to_5" as const, mean: round(r.mean) };
          case "nps":
            return { ...base, type: "score_0_to_10" as const, mean: round(r.mean), nps: r.nps };
          case "choice":
            return {
              ...base,
              type: "multiple_choice" as const,
              distribution: r.distribution.map((d) => ({ option: d.label, pct: round(d.pct) })),
            };
          case "text":
            return { ...base, type: "open_text" as const, texts: texts(r.texts) };
        }
      }),
    },
  };
}
