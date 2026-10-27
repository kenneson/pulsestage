// Rascunho do formulário de pergunta: estado editável, ponto de partida e conversão para a entrada do builder.
// Sem "use client": a página do roteiro (Server Component) monta os rascunhos das perguntas já salvas.

import {
  buildInteractionInput,
  DEFAULT_OPTION_COUNT,
  defaultOption,
  defaultSettings,
  hasOptions,
  normalizeSettings,
  parseGuessAnswerKey,
  parseQuizTextAnswerKey,
  type InteractionInput,
  type InteractionType,
  type NormalizedSettings,
  type ParsedInteractionInput,
} from "@/lib/domain/interactions";
import type { InteractionOptionRow, InteractionRow } from "@/lib/supabase/types";

export type EditableOption = { id?: string; label: string; isCorrect: boolean; points: number; imagePath: string | null };

export type InteractionDraft = {
  id: string | null;
  type: InteractionType;
  title: string;
  description: string;
  settings: NormalizedSettings;
  options: EditableOption[];
  /** notas do palestrante (só ele vê, na sala ao vivo) */
  notes: string;
  /** "Adivinhe o número": resposta certa (null = ainda não preenchida) */
  answerValue: number | null;
  /** "Quiz de digitar": respostas aceitas */
  accepted: string[];
};

/** Pergunta nova no formulário: mesmos padrões da IA e do MCP (`defaultSettings` no domínio). */
export function emptyDraft(type: InteractionType): InteractionDraft {
  return {
    id: null,
    type,
    title: "",
    description: "",
    settings: defaultSettings(type),
    options: hasOptions(type)
      ? Array.from({ length: DEFAULT_OPTION_COUNT }, (_, i) => defaultOption(type === "quiz" && i === 0))
      : [],
    notes: "",
    answerValue: null,
    accepted: type === "quiz_text" ? [""] : [],
  };
}

/** Rascunho de uma pergunta salva (linha do dono, com gabarito e notas). */
export function draftFromRow(
  row: InteractionRow,
  options: readonly InteractionOptionRow[],
  type: InteractionType,
): InteractionDraft {
  const guess = type === "guess_number" ? parseGuessAnswerKey(row.answer_key) : null;
  const text = type === "quiz_text" ? parseQuizTextAnswerKey(row.answer_key) : null;
  return {
    id: row.id,
    type,
    title: row.title,
    description: row.description ?? "",
    settings: normalizeSettings(type, row.settings),
    options: [...options]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, label: o.label, isCorrect: o.is_correct, points: o.points, imagePath: o.image_path })),
    notes: row.speaker_notes ?? "",
    answerValue: guess?.value ?? null,
    accepted: text?.accepted ?? (type === "quiz_text" ? [""] : []),
  };
}

/** Rascunho de uma pergunta ainda não salva (ex.: sugestão da IA), para revisar no formulário antes de salvar. */
export function draftFromInput(input: ParsedInteractionInput): InteractionDraft {
  const base = emptyDraft(input.type);
  return {
    ...base,
    title: input.title,
    description: input.description ?? "",
    notes: input.notes ?? "",
    settings: { ...base.settings, ...normalizeSettings(input.type, input.settings) },
    options:
      "options" in input
        ? input.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect, points: o.points, imagePath: o.imagePath ?? null }))
        : base.options,
    answerValue: input.type === "guess_number" ? input.answerKey.value : null,
    accepted: input.type === "quiz_text" ? [...input.answerKey.accepted] : base.accepted,
  };
}

/** Entrada do builder a partir do rascunho (validada depois com `interactionInputSchema`). */
export function draftToInput(draft: InteractionDraft): InteractionInput {
  const answerKey =
    draft.type === "guess_number"
      ? { value: draft.answerValue ?? Number.NaN }
      : draft.type === "quiz_text"
        ? { accepted: draft.accepted.map((a) => a.trim()).filter(Boolean) }
        : null;
  return buildInteractionInput({
    type: draft.type,
    title: draft.title,
    description: draft.description || undefined,
    notes: draft.notes.trim(),
    settings: draft.settings,
    options: draft.options.map((o) => ({
      id: o.id,
      label: o.label,
      isCorrect: o.isCorrect,
      points: o.points,
      imagePath: o.imagePath,
    })),
    answerKey,
  });
}
