// Resultado do quiz no celular de quem participa ("Acertou! +850 pontos"). Regras puras (sem I/O).
// O resultado só sai depois que ninguém mais pode responder: senão, um celular contaria a resposta certa
// para a sala inteira enquanto o quiz ainda está aberto.

import { z } from "zod";
import { responseTimeMs, quizTimedOut } from "./scoring.ts";
import { QUIZ_GRACE_MS } from "./interactions.ts";

export type QuizRevealInput = {
  /** a pergunta ainda está aberta para respostas */
  isActive: boolean;
  /** quando foi aberta; null = nunca foi ao ar (não revela: a plateia não viu essa pergunta) */
  activatedAt: string | null;
  timerSeconds: number | null;
  now: number;
};

export type QuizReveal = { revealed: true } | { revealed: false; retryInMs: number | null };

/**
 * Pode revelar? Sim quando a pergunta já foi ao ar e foi encerrada (ou trocada), ou quando o tempo
 * acabou com a folga de rede. Sem tempo e ainda aberta: espera o palestrante encerrar (`retryInMs` null).
 */
export function quizReveal({ isActive, activatedAt, timerSeconds, now }: QuizRevealInput): QuizReveal {
  if (!activatedAt) return { revealed: false, retryInMs: null };
  if (!isActive) return { revealed: true };
  const elapsed = responseTimeMs(activatedAt, now);
  if (quizTimedOut(elapsed, timerSeconds)) return { revealed: true };
  if (!timerSeconds) return { revealed: false, retryInMs: null };
  return { revealed: false, retryInMs: Math.max(250, timerSeconds * 1000 + QUIZ_GRACE_MS - elapsed + 250) };
}

const standingSchema = z.object({ points: z.number(), correct: z.number(), rank: z.number(), of: z.number() });

export const quizResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending"), retryInMs: z.number().nullable() }),
  z.object({
    status: z.literal("revealed"),
    /** respondeu a tempo */
    answered: z.boolean(),
    correct: z.boolean(),
    /** pontos desta pergunta (0 se errou ou não respondeu) */
    points: z.number(),
    /** texto da alternativa certa, para quem errou ou não respondeu */
    correctLabel: z.string().nullable(),
    /** total e posição no quiz da sessão; null = ainda fora do ranking */
    standing: standingSchema.nullable(),
  }),
]);

export type QuizResult = z.infer<typeof quizResultSchema>;
export type RevealedQuizResult = Extract<QuizResult, { status: "revealed" }>;

/** Tom da tela de resultado. */
export function quizResultKind(result: RevealedQuizResult): "correct" | "wrong" | "missed" {
  return !result.answered ? "missed" : result.correct ? "correct" : "wrong";
}

/** Quando o celular deve perguntar ao servidor: no fim do tempo (com folga) ou já, se a pergunta saiu do ar. */
export function quizRevealDelayMs(input: { stillActive: boolean; activatedAt: string | null; timerSeconds: number | null; now: number }): number | null {
  if (!input.stillActive) return 0;
  if (!input.activatedAt || !input.timerSeconds) return null;
  const elapsed = responseTimeMs(input.activatedAt, input.now);
  return Math.max(0, input.timerSeconds * 1000 + QUIZ_GRACE_MS - elapsed + 300);
}
