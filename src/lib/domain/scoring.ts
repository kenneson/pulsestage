// Regras de pontuação e moderação das respostas da plateia. Regras puras (sem I/O).
// O servidor lê a interação, a alternativa e as opções da sessão e decide aqui: prazo do quiz, pontos,
// faixa da escala e se a resposta (ou a pergunta da plateia) entra visível, aguardando aprovação ou oculta.

import { quizPoints } from "./gamification.ts";
import { QUIZ_GRACE_MS } from "./interactions.ts";
import { containsProfanity } from "./profanity.ts";
import type { Locale } from "./locale.ts";

// ---------------------------------------------------------------------------
// Moderação
// ---------------------------------------------------------------------------

export type Moderation = "visible" | "pending" | "hidden";

/**
 * Palavrão vence: entra oculto (o palestrante vê e pode liberar), sem avisar quem enviou.
 * Senão, com aprovação ligada, aguarda; senão, aparece.
 */
export function moderationFor({ filtered, moderated }: { filtered: boolean; moderated: boolean }): Moderation {
  return filtered ? "hidden" : moderated ? "pending" : "visible";
}

/** Texto barrado pelo filtro de palavrões da sessão (desligado, nada é barrado). */
export function isFilteredText(text: string, rules: { profanityFilter: boolean; locale: Locale }): boolean {
  return rules.profanityFilter && containsProfanity(text, rules.locale);
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

/** Tempo de resposta a partir da abertura da pergunta; sem abertura registrada, conta como agora. */
export function responseTimeMs(activatedAt: string | null, now: number): number {
  const opened = activatedAt ? Date.parse(activatedAt) : now;
  return Math.max(0, now - opened);
}

/** Passou do tempo do quiz, já com a folga de rede (QUIZ_GRACE_MS)? Sem tempo limite, nunca. */
export function quizTimedOut(elapsedMs: number, timerSeconds: number | null): boolean {
  if (!timerSeconds) return false;
  return elapsedMs > timerSeconds * 1000 + QUIZ_GRACE_MS;
}

export type QuizAnswerOutcome =
  | { ok: true; isCorrect: boolean; points: number; responseTimeMs: number }
  | { ok: false; error: "participant.errors.timeUp"; code: "timeout" };

/**
 * Resultado de uma resposta de quiz, calculado no servidor: recusa depois do prazo; errada vale 0;
 * certa vale os pontos da alternativa (com bônus de velocidade, se ligado).
 */
export function quizAnswerOutcome(input: {
  option: { isCorrect: boolean; points: number };
  activatedAt: string | null;
  now: number;
  timerSeconds: number | null;
  speedBonus: boolean;
}): QuizAnswerOutcome {
  const elapsed = responseTimeMs(input.activatedAt, input.now);
  if (quizTimedOut(elapsed, input.timerSeconds)) {
    return { ok: false, error: "participant.errors.timeUp", code: "timeout" };
  }
  return {
    ok: true,
    isCorrect: input.option.isCorrect,
    points: input.option.isCorrect ? quizPoints(input.option.points, elapsed, input.timerSeconds, input.speedBonus) : 0,
    responseTimeMs: elapsed,
  };
}

// ---------------------------------------------------------------------------
// Escala
// ---------------------------------------------------------------------------

/** A nota está dentro da faixa configurada (inclusive nas pontas)? */
export function isRatingInRange(value: number, range: { min: number; max: number }): boolean {
  return value >= range.min && value <= range.max;
}
