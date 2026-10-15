// Perguntas da plateia. Regras puras (sem I/O).

import { z } from "zod";

export const QUESTION_MIN = 2;
export const QUESTION_MAX = 280;
/** Perguntas por participante a cada 10 minutos (evita enxurrada). */
export const QUESTION_LIMIT = 5;
export const QUESTION_WINDOW_MS = 10 * 60 * 1000;
/** Quantas aparecem na lista do telão. */
export const DISPLAY_QUESTIONS = 5;

export const askQuestionSchema = z.object({
  body: z
    .string({ error: "validation.audienceQuestionRequired" })
    .trim()
    .min(QUESTION_MIN, "validation.audienceQuestionRequired")
    .max(QUESTION_MAX, `A pergunta pode ter até ${QUESTION_MAX} caracteres.`),
  /** mostrar o nome escolhido na entrada (sem nome, vai anônima) */
  withName: z.boolean(),
});

export const QUESTION_STATUSES = ["pending", "visible", "answered", "hidden"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export function isQuestionStatus(value: string): value is QuestionStatus {
  return (QUESTION_STATUSES as readonly string[]).includes(value);
}

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  pending: "Aguardando aprovação",
  visible: "Aberta",
  answered: "Respondida",
  hidden: "Oculta",
};

/** Como a pergunta chega ao celular de quem participa (sem ids de participante). */
export const publicQuestionSchema = z.object({
  id: z.string(),
  body: z.string(),
  author: z.string().nullable(),
  upvotes: z.number(),
  status: z.enum(["pending", "visible", "answered"]),
  mine: z.boolean(),
  voted: z.boolean(),
  createdAt: z.string(),
});
export type PublicQuestion = z.infer<typeof publicQuestionSchema>;

export const participantQuestionsSchema = z.object({
  enabled: z.boolean(),
  moderated: z.boolean(),
  questions: z.array(publicQuestionSchema),
});
export type ParticipantQuestions = z.infer<typeof participantQuestionsSchema>;

type Sortable = { status: string; upvotes: number; createdAt: string };

/**
 * Abertas primeiro (mais curtidas, depois mais antigas), depois as que aguardam aprovação,
 * e as respondidas no fim (mais recentes primeiro).
 */
export function sortQuestions<T extends Sortable>(list: readonly T[]): T[] {
  const rank = (s: string) => (s === "visible" ? 0 : s === "pending" ? 1 : s === "answered" ? 2 : 3);
  return [...list].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      (a.status === "answered" ? b.createdAt.localeCompare(a.createdAt) : 0) ||
      b.upvotes - a.upvotes ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

/** As que vão para a lista do telão: só abertas, das mais curtidas. */
export function topQuestions<T extends Sortable>(list: readonly T[], limit = DISPLAY_QUESTIONS): T[] {
  return sortQuestions(list.filter((q) => q.status === "visible")).slice(0, limit);
}

/** Perguntas no telão: lista ou destaque, enquanto a sessão está ao vivo. */
export function questionsOnScreen(live: { status: string; show_questions: boolean } | null | undefined): boolean {
  return Boolean(live && live.status === "live" && live.show_questions);
}
