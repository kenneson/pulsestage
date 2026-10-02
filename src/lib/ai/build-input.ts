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
  const { scores } = overview;

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
      feedbackCount: scores.count,
      confidenceHint: confidenceFromSample(scores.count),
    },
    rates: {
      responseRate: round(overview.responseRate),
      participationRate: round(overview.participationRate),
      feedbackResponseRate: round(overview.feedbackResponseRate),
    },
    feedbackAverages: {
      overall_0_to_10: round(scores.overall),
      clarity_1_to_5: round(scores.clarity),
      engagement_1_to_5: round(scores.engagement),
      content_1_to_5: round(scores.content),
      applicability_1_to_5: round(scores.applicability),
    },
    participationOverTime: pulse.map((p) => ({
      minute: p.minute,
      interaction: p.title,
      rate: round(p.rate),
      responses: p.responses,
    })),
    interactions,
    feedbackTexts: {
      mostValuable: texts(data.feedback.map((f) => f.most_valuable_part)),
      improvement: texts(data.feedback.map((f) => f.improvement)),
      comments: texts(data.feedback.map((f) => f.comment)),
    },
  };
}
