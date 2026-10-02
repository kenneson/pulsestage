import type { Confidence } from "@/lib/domain/metrics";
import type { InsightOutput } from "./schema";

/** Dados agregados enviados à IA. Sem nomes, e-mails ou telefones. */
export type InsightInput = {
  session: { title: string; description: string | null; durationMinutes: number | null };
  sample: {
    participants: number;
    participantsWhoResponded: number;
    totalResponses: number;
    feedbackCount: number;
    confidenceHint: Confidence;
  };
  rates: {
    responseRate: number | null;
    participationRate: number | null;
    feedbackResponseRate: number | null;
  };
  feedbackAverages: {
    overall_0_to_10: number | null;
    clarity_1_to_5: number | null;
    engagement_1_to_5: number | null;
    content_1_to_5: number | null;
    applicability_1_to_5: number | null;
  };
  participationOverTime: { minute: number | null; interaction: string; rate: number | null; responses: number }[];
  interactions: {
    position: number;
    type: string;
    title: string;
    responses: number;
    summary: Record<string, unknown>;
  }[];
  feedbackTexts: { mostValuable: string[]; improvement: string[]; comments: string[] };
};

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateInsights(input: InsightInput): Promise<InsightOutput>;
}

export class AIProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIProviderError";
  }
}
