// Regras puras da sala ao vivo da leva "Mentimeter": seletor de grupos, ritmo próprio e notas.
// (Quem está num grupo: segment-results.ts; cronômetro: result-display.ts.)
// Sem I/O: as rotas de /api/live e os componentes de components/live usam daqui.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Comparar grupos
// ---------------------------------------------------------------------------

export type SegmentGroup = { interactionId: string; title: string; options: { id: string; label: string }[] };

/** Enquetes marcadas como "usar para comparar grupos", com as alternativas, na ordem do roteiro. */
export function segmentGroups(
  interactions: readonly {
    id: string;
    type: string;
    title: string;
    settings: { isSegment: boolean };
    options: readonly { id: string; label: string }[];
  }[],
): SegmentGroup[] {
  return interactions
    .filter((i) => i.type === "multiple_choice" && i.settings.isSegment && i.options.length > 0)
    .map((i) => ({ interactionId: i.id, title: i.title, options: i.options.map((o) => ({ id: o.id, label: o.label })) }));
}

/** Alternativa do filtro e a enquete dela (null se o filtro não é uma alternativa conhecida). */
export function findSegment(
  groups: readonly SegmentGroup[],
  optionId: string | null,
): { group: SegmentGroup; option: { id: string; label: string } } | null {
  if (!optionId) return null;
  for (const group of groups) {
    const option = group.options.find((o) => o.id === optionId);
    if (option) return { group, option };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ritmo próprio
// ---------------------------------------------------------------------------

export type SelfPaceProgress = {
  /** pessoas que responderam ao menos uma pergunta */
  started: number;
  /** pessoas que responderam todas as perguntas que aceitam resposta */
  finished: number;
};

/** Quantas pessoas começaram e quantas terminaram tudo (cada par pessoa/pergunta conta uma vez). */
export function selfPaceProgress(
  rows: readonly { participant_id: string; interaction_id: string }[],
  answerableIds: readonly string[],
): SelfPaceProgress {
  const wanted = new Set(answerableIds);
  const byPerson = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!wanted.has(row.interaction_id)) continue;
    const answered = byPerson.get(row.participant_id) ?? new Set<string>();
    answered.add(row.interaction_id);
    byPerson.set(row.participant_id, answered);
  }
  let finished = 0;
  if (wanted.size > 0) for (const answered of byPerson.values()) if (answered.size >= wanted.size) finished++;
  return { started: byPerson.size, finished };
}

/** Fração (0–1) de quem entrou que já respondeu; sem ninguém na sala, 0. */
export function share(count: number, of: number): number {
  if (of <= 0) return 0;
  return Math.min(1, Math.max(0, count / of));
}

// ---------------------------------------------------------------------------
// Notas do palestrante
// ---------------------------------------------------------------------------

const slideNotesSchema = z.record(z.string(), z.string());

/** sessions.slide_notes ({ "1": "texto" }, slide a partir de 1) → mapa pelo índice do deck (a partir de 0). */
export function parseSlideNotes(raw: unknown): Record<number, string> {
  const parsed = slideNotesSchema.safeParse(raw);
  if (!parsed.success) return {};
  const notes: Record<number, string> = {};
  for (const [key, text] of Object.entries(parsed.data)) {
    const slide = Number(key);
    if (Number.isInteger(slide) && slide >= 1 && text.trim()) notes[slide - 1] = text.trim();
  }
  return notes;
}
