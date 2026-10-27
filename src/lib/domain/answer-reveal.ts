// "Revelar resposta" no telão: o que pode sair do servidor e quando. Regras puras (sem I/O).
// O gabarito (is_correct, answer_key) é privado; só sai com a flag ligada pelo palestrante e a pergunta no ar.

import { z } from "zod";
import { isScoredType, parseGuessAnswerKey, parseQuizTextAnswerKey, type InteractionType } from "./interactions.ts";
import { isAcceptedAnswer } from "./scoring.ts";

export const revealedAnswerSchema = z.discriminatedUnion("kind", [
  /** quiz de alternativas */
  z.object({ kind: z.literal("option"), optionId: z.string() }),
  /** adivinhe o número */
  z.object({ kind: z.literal("number"), value: z.number() }),
  /** quiz de digitar: respostas aceitas como o palestrante escreveu */
  z.object({ kind: z.literal("text"), accepted: z.array(z.string()) }),
]);

export type RevealedAnswer = z.infer<typeof revealedAnswerSchema>;

/** Tipos com resposta para revelar no telão. */
export const canRevealAnswer = isScoredType;

/** Campos de session_live_state que liberam a resposta. */
export type AnswerGate = { status: string; active_interaction_id: string | null; answer_revealed: boolean };

/** Só com "Revelar resposta" ligado, a sessão em andamento e esta pergunta no ar. */
export function answerRevealAllowed(state: AnswerGate | null | undefined, interactionId: string): boolean {
  if (!state) return false;
  return (
    (state.status === "live" || state.status === "paused") &&
    state.answer_revealed &&
    state.active_interaction_id === interactionId
  );
}

/** Resposta pública a partir do gabarito privado; null quando o tipo não tem ou o gabarito está incompleto. */
export function revealedAnswerOf(input: {
  type: InteractionType;
  options: readonly { id: string; is_correct: boolean }[];
  answerKey: unknown;
}): RevealedAnswer | null {
  switch (input.type) {
    case "quiz": {
      const correct = input.options.find((o) => o.is_correct);
      return correct ? { kind: "option", optionId: correct.id } : null;
    }
    case "guess_number": {
      const key = parseGuessAnswerKey(input.answerKey);
      return key ? { kind: "number", value: key.value } : null;
    }
    case "quiz_text": {
      const key = parseQuizTextAnswerKey(input.answerKey);
      return key ? { kind: "text", accepted: key.accepted } : null;
    }
    default:
      return null;
  }
}

/** Alternativa certa de um quiz, se a resposta revelada for desse tipo. */
export function revealedOptionId(answer: RevealedAnswer | null | undefined): string | null {
  return answer?.kind === "option" ? answer.optionId : null;
}

/** A resposta digitada (já normalizada nos resultados) conta como certa? Mesma regra da pontuação. */
export function isRevealedText(text: string, answer: RevealedAnswer | null | undefined): boolean {
  return answer?.kind === "text" && isAcceptedAnswer(text, answer.accepted);
}

/** Parte das respostas digitadas que acertou (contagens por texto normalizado). */
export function textCorrectShare(counts: Record<string, number>, total: number, answer: RevealedAnswer | null | undefined): number | null {
  if (answer?.kind !== "text" || total <= 0) return null;
  let correct = 0;
  for (const [text, count] of Object.entries(counts)) if (isAcceptedAnswer(text, answer.accepted)) correct += count;
  return Math.min(1, correct / total);
}
