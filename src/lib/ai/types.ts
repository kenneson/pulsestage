import type { Confidence } from "@/lib/domain/metrics";
import type { InsightOutput } from "./schema";

/** Dados agregados enviados à IA. Sem nomes, e-mails ou telefones. */
export type InsightInput = {
  session: { title: string; description: string | null; durationMinutes: number | null };
  sample: {
    participants: number;
    participantsWhoResponded: number;
    totalResponses: number;
    surveyResponses: number;
    confidenceHint: Confidence;
  };
  rates: {
    responseRate: number | null;
    participationRate: number | null;
    surveyResponseRate: number | null;
  };
  participationOverTime: { minute: number | null; interaction: string; rate: number | null; responses: number }[];
  interactions: {
    position: number;
    type: string;
    title: string;
    responses: number;
    summary: Record<string, unknown>;
  }[];
  /** Pesquisa pós-evento (modelo escolhido pelo speaker) agregada por dimensão e por pergunta. */
  survey: {
    name: string | null;
    dimensions: { dimension: string; scale: "1-5" | "0-10"; mean: number; answers: number }[];
    questions: {
      question: string;
      type: "scale_1_to_5" | "score_0_to_10" | "multiple_choice" | "open_text";
      dimension: string | null;
      answers: number;
      mean?: number | null;
      nps?: number | null;
      distribution?: { option: string; pct: number | null }[];
      texts?: string[];
    }[];
  };
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
