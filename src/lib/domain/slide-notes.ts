import { z } from "zod";
import { MAX_SLIDES } from "./deck.ts";

// Notas do palestrante por slide (sessions.slide_notes): { "1": "texto", ... }, número do slide a partir de 1.
// Só o dono lê (painel e sala ao vivo). Regras puras, sem I/O.

export const SLIDE_NOTE_MAX = 2000;

export const slideNoteInputSchema = z.object({
  /** número do slide, a partir de 1 */
  slide: z.number().int().min(1).max(MAX_SLIDES),
  text: z.string().max(SLIDE_NOTE_MAX, "validation.notesTooLong"),
});

export type SlideNotes = Record<number, string>;

/** Lê a coluna jsonb; ignora chaves que não são número de slide e textos vazios ou inválidos. */
export function parseSlideNotes(raw: unknown): SlideNotes {
  const notes: SlideNotes = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return notes;
  for (const [key, value] of Object.entries(raw)) {
    const slide = Number(key);
    if (!Number.isInteger(slide) || slide < 1 || String(slide) !== key) continue;
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text) notes[slide] = text.slice(0, SLIDE_NOTE_MAX);
  }
  return notes;
}

/** Nota do slide de índice `index` (base 0, como no deck); null sem nota. */
export function slideNoteAt(notes: SlideNotes, index: number): string | null {
  return notes[index + 1] ?? null;
}

/** Grava (ou apaga, com texto vazio) a nota de um slide; devolve o objeto para a coluna jsonb. */
export function withSlideNote(raw: unknown, slide: number, text: string): Record<string, string> {
  const notes = parseSlideNotes(raw);
  const trimmed = text.trim();
  if (trimmed) notes[slide] = trimmed;
  else delete notes[slide];
  return Object.fromEntries(Object.entries(notes).sort(([a], [b]) => Number(a) - Number(b)));
}

/** Notas de slides que não existem mais (deck trocado por outro menor) ficam guardadas, mas não aparecem. */
export function visibleSlideNotes(notes: SlideNotes, slideCount: number): SlideNotes {
  return Object.fromEntries(Object.entries(notes).filter(([key]) => Number(key) <= slideCount));
}
