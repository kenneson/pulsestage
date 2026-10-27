import { z } from "zod";
import { MAX_SLIDES, type Arrangement, type DeckInteraction, anchorOf } from "./deck.ts";
import { parseSlideNotes } from "./slide-notes.ts";

// Nova ordem dos slides enviados. Regra pura (sem I/O).
// `order[i]` é o número (a partir de 1) do slide atual que passa a ocupar a posição i + 1.
// Perguntas e notas acompanham o slide: a pergunta que vinha "depois do slide 5" continua depois dele,
// onde ele estiver. "Antes do 1º slide" (0) e "no fim" (null) não mudam.

export const slideOrderSchema = z.array(z.number().int().min(1).max(MAX_SLIDES)).min(1).max(MAX_SLIDES);

/** A ordem é uma permutação de 1..slideCount (nenhum slide some nem se repete). */
export function isSlideOrder(order: readonly number[], slideCount: number): boolean {
  if (order.length !== slideCount) return false;
  const seen = new Set(order);
  return seen.size === slideCount && order.every((n) => Number.isInteger(n) && n >= 1 && n <= slideCount);
}

export function isIdentityOrder(order: readonly number[]): boolean {
  return order.every((n, i) => n === i + 1);
}

/** Ordem inicial (como foi enviado). */
export function identityOrder(slideCount: number): number[] {
  return Array.from({ length: slideCount }, (_, i) => i + 1);
}

/** Move o item da posição `from` para `to` (índices base 0). Devolve uma lista nova. */
export function moveInOrder(order: readonly number[], from: number, to: number): number[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return [...order];
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** Posição nova (a partir de 1) de cada slide atual: newPosition[slideAtual] = posição. */
function newPositions(order: readonly number[]): Map<number, number> {
  return new Map(order.map((slide, index) => [slide, index + 1]));
}

/** Para onde vai o after_slide de uma pergunta. */
export function remapAfterSlide(afterSlide: number | null, order: readonly number[]): number | null {
  const slideCount = order.length;
  if (afterSlide === null || afterSlide <= 0 || afterSlide >= slideCount) return afterSlide;
  const position = newPositions(order).get(afterSlide);
  if (position === undefined) return afterSlide;
  // Depois do último slide é o mesmo que "no fim".
  return position >= slideCount ? null : position;
}

/**
 * Perguntas na nova ordem do deck: cada uma segue o seu slide, e a ordem do roteiro passa a seguir a do deck
 * (por lacuna; dentro da mesma lacuna, a ordem que já tinham).
 */
export function reorderInteractions(interactions: readonly DeckInteraction[], order: readonly number[]): Arrangement {
  const slideCount = order.length;
  const moved = interactions.map((item, index) => ({
    id: item.id,
    afterSlide: remapAfterSlide(item.afterSlide, order),
    index,
  }));
  moved.sort((a, b) => anchorOf(a.afterSlide, slideCount) - anchorOf(b.afterSlide, slideCount) || a.index - b.index);
  return { ids: moved.map((i) => i.id), afterSlides: moved.map((i) => i.afterSlide) };
}

/** Notas por slide na nova numeração (as de slides que não existem mais ficam como estão). */
export function reorderSlideNotes(raw: unknown, order: readonly number[]): Record<string, string> {
  const notes = parseSlideNotes(raw);
  const positions = newPositions(order);
  const next: Record<number, string> = {};
  for (const [key, text] of Object.entries(notes)) {
    const slide = Number(key);
    next[positions.get(slide) ?? slide] = text;
  }
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => Number(a) - Number(b)));
}
