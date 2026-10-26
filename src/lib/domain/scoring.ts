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

// ---------------------------------------------------------------------------
// Adivinhe o número
// ---------------------------------------------------------------------------

/**
 * Proximidade do chute (1 = em cheio, 0 = longe). Zera a uma distância de 25% da faixa (max − min):
 * numa faixa de 0 a 100, errar por 10 vale 60% dos pontos e errar por 25 ou mais não vale nada.
 */
export const GUESS_ZERO_AT = 0.25;
/** "Acertou" no celular: chegou a 90% ou mais de proximidade. */
export const GUESS_HIT = 0.9;

export function guessCloseness(guess: number, correct: number, range: { min: number; max: number }): number {
  const span = Math.max(range.max - range.min, Number.EPSILON);
  return Math.max(0, 1 - Math.abs(guess - correct) / (span * GUESS_ZERO_AT));
}

/** Arredonda o chute para as casas decimais permitidas (0 a 2). */
export function roundGuess(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export type ScoredOutcome =
  | { ok: true; isCorrect: boolean; points: number; responseTimeMs: number }
  | { ok: false; error: "participant.errors.timeUp"; code: "timeout" }
  | { ok: false; error: "participant.errors.guessOutOfRange"; code?: undefined };

export function guessOutcome(input: {
  value: number;
  correct: number;
  settings: { numMin: number; numMax: number; decimals: number; maxPoints: number; timerSeconds: number | null };
  activatedAt: string | null;
  now: number;
}): ScoredOutcome {
  const elapsed = responseTimeMs(input.activatedAt, input.now);
  if (quizTimedOut(elapsed, input.settings.timerSeconds)) {
    return { ok: false, error: "participant.errors.timeUp", code: "timeout" };
  }
  const value = roundGuess(input.value, input.settings.decimals);
  if (value < input.settings.numMin || value > input.settings.numMax) {
    return { ok: false, error: "participant.errors.guessOutOfRange" };
  }
  const closeness = guessCloseness(value, input.correct, { min: input.settings.numMin, max: input.settings.numMax });
  return {
    ok: true,
    isCorrect: closeness >= GUESS_HIT,
    points: Math.round(input.settings.maxPoints * closeness),
    responseTimeMs: elapsed,
  };
}

// ---------------------------------------------------------------------------
// Quiz de digitar
// ---------------------------------------------------------------------------

/** Forma comparável de uma resposta digitada: sem acentos, maiúsculas, pontuação nem espaços repetidos. */
export function normalizeAnswerText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

/** Uma letra de diferença é tolerada em respostas com 6 letras ou mais (erro de digitação). */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function isAcceptedAnswer(text: string, accepted: readonly string[]): boolean {
  const answer = normalizeAnswerText(text);
  if (!answer) return false;
  return accepted.some((raw) => {
    const target = normalizeAnswerText(raw);
    return target === answer || (target.length >= 6 && withinOneEdit(target, answer));
  });
}

export function quizTextOutcome(input: {
  text: string;
  accepted: readonly string[];
  settings: { maxPoints: number; speedBonus: boolean; timerSeconds: number | null };
  activatedAt: string | null;
  now: number;
}): ScoredOutcome {
  const elapsed = responseTimeMs(input.activatedAt, input.now);
  if (quizTimedOut(elapsed, input.settings.timerSeconds)) {
    return { ok: false, error: "participant.errors.timeUp", code: "timeout" };
  }
  const isCorrect = isAcceptedAnswer(input.text, input.accepted);
  return {
    ok: true,
    isCorrect,
    points: isCorrect ? quizPoints(input.settings.maxPoints, elapsed, input.settings.timerSeconds, input.settings.speedBonus) : 0,
    responseTimeMs: elapsed,
  };
}
