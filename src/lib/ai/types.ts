import type { Confidence } from "@/lib/domain/metrics";

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
  /** Envia instruções + dados e devolve o texto da resposta; quem chama valida o JSON. */
  complete(system: string, user: string, options: { temperature: number }): Promise<string>;
}

/** Mensagem para o speaker a partir do status HTTP do provedor. */
export function providerErrorMessage(status: number, provider: string, model: string): string {
  if (status === 404) {
    return `O modelo "${model}" não está disponível no ${provider}. Defina AI_MODEL com um modelo atual do provedor.`;
  }
  if (status === 401 || status === 403) return `A chave de IA foi recusada pelo ${provider}. Confira AI_API_KEY.`;
  if (status === 429) return "O provedor de IA atingiu o limite de uso. Tente de novo em alguns minutos.";
  return `O provedor de IA respondeu com erro ${status}.`;
}

export class AIProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIProviderError";
  }
}
