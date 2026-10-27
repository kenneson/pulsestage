// Ritmo próprio (`sessions.pace = 'self'`): cada pessoa percorre o roteiro inteiro no celular, sem condução.
// Regras puras (sem I/O): o formato da rota GET /api/participant/[id]/journey e a navegação da jornada.

import { z } from "zod";
import { acceptsResponses, publicInteractionSchema, type PublicInteraction } from "./interactions.ts";

export const journeyResponseSchema = z.object({
  /** status da sessão (rascunho espera; ao vivo percorre; encerrada mostra a pesquisa) */
  status: z.string(),
  /** roteiro na ordem, sem gabarito (a mesma visão pública do celular ao vivo) */
  items: z.array(publicInteractionSchema),
  /** ids das perguntas que a pessoa já respondeu */
  answered: z.array(z.string()),
});

export type JourneyResponse = z.infer<typeof journeyResponseSchema>;

type Item = Pick<PublicInteraction, "id" | "type">;

/** Perguntas (sem os slides de conteúdo). */
export function journeyQuestions<T extends Item>(items: readonly T[]): T[] {
  return items.filter((item) => acceptsResponses(item.type));
}

/**
 * Onde a pessoa retoma ao abrir a página: logo depois da última pergunta respondida (o conteúdo que vem
 * depois reaparece). Nada respondido: o começo. Passou da última: a tela final (`items.length`).
 */
export function resumeIndex(items: readonly Item[], answered: ReadonlySet<string>): number {
  let last = -1;
  items.forEach((item, index) => {
    if (answered.has(item.id)) last = index;
  });
  return Math.min(items.length, last + 1);
}

/** Primeira pergunta ainda sem resposta (para quem pulou alguma); -1 se respondeu tudo. */
export function firstUnanswered(items: readonly Item[], answered: ReadonlySet<string>): number {
  return items.findIndex((item) => acceptsResponses(item.type) && !answered.has(item.id));
}

/** Quantas perguntas faltam responder. */
export function unansweredCount(items: readonly Item[], answered: ReadonlySet<string>): number {
  return journeyQuestions(items).filter((item) => !answered.has(item.id)).length;
}

/** Passo limitado ao roteiro: de 0 à tela final (`items.length`). */
export function stepTo(index: number, total: number): number {
  return Math.min(total, Math.max(0, index));
}
