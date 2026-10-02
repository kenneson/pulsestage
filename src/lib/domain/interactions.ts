import { z } from "zod";
import type { InteractionOptionRow, InteractionRow } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export const INTERACTION_TYPES = ["multiple_choice", "rating", "word_cloud", "open_text", "quiz"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];
export const interactionTypeSchema = z.enum(INTERACTION_TYPES);

export function isInteractionType(value: string): value is InteractionType {
  return (INTERACTION_TYPES as readonly string[]).includes(value);
}

export function hasOptions(type: InteractionType): type is "multiple_choice" | "quiz" {
  return type === "multiple_choice" || type === "quiz";
}

export const INTERACTION_TYPE_META: Record<InteractionType, { label: string; description: string }> = {
  multiple_choice: { label: "Enquete", description: "Uma escolha entre alternativas." },
  rating: { label: "Escala", description: "Nota em uma escala, como 1 a 5." },
  word_cloud: { label: "Nuvem de palavras", description: "Respostas curtas agrupadas por frequência." },
  open_text: { label: "Pergunta aberta", description: "Resposta livre em uma frase." },
  quiz: { label: "Quiz", description: "Pergunta com resposta correta e pontuação." },
};

// ---------------------------------------------------------------------------
// Settings (JSONB) — um schema por tipo
// ---------------------------------------------------------------------------

export const multipleChoiceSettingsSchema = z.object({});

export const ratingSettingsSchema = z
  .object({
    min: z.number().int().min(0).max(1).default(1),
    max: z.number().int().min(2).max(10).default(5),
    minLabel: z.string().trim().max(40).optional(),
    maxLabel: z.string().trim().max(40).optional(),
  })
  .refine((s) => s.min < s.max, { error: "O mínimo precisa ser menor que o máximo." });

export const wordCloudSettingsSchema = z.object({
  maxLength: z.number().int().min(5).max(50).default(30),
});

export const openTextSettingsSchema = z.object({
  maxLength: z.number().int().min(20).max(500).default(280),
  showOnDisplay: z.boolean().default(true),
});

export const quizSettingsSchema = z.object({
  timerSeconds: z.number().int().min(5).max(300).nullable().default(null),
});

/** Settings achatados com defaults, usados pela UI e pelas regras de resposta. */
export const normalizedSettingsSchema = z.object({
  min: z.number(),
  max: z.number(),
  minLabel: z.string().nullable(),
  maxLabel: z.string().nullable(),
  maxLength: z.number(),
  showOnDisplay: z.boolean(),
  timerSeconds: z.number().nullable(),
});
export type NormalizedSettings = z.infer<typeof normalizedSettingsSchema>;

const DEFAULT_SETTINGS: NormalizedSettings = {
  min: 1,
  max: 5,
  minLabel: null,
  maxLabel: null,
  maxLength: 280,
  showOnDisplay: true,
  timerSeconds: null,
};

export function normalizeSettings(type: InteractionType, raw: unknown): NormalizedSettings {
  const source = raw ?? {};
  switch (type) {
    case "rating": {
      const parsed = ratingSettingsSchema.safeParse(source);
      if (!parsed.success) return DEFAULT_SETTINGS;
      return {
        ...DEFAULT_SETTINGS,
        min: parsed.data.min,
        max: parsed.data.max,
        minLabel: parsed.data.minLabel || null,
        maxLabel: parsed.data.maxLabel || null,
      };
    }
    case "word_cloud": {
      const parsed = wordCloudSettingsSchema.safeParse(source);
      return { ...DEFAULT_SETTINGS, maxLength: parsed.success ? parsed.data.maxLength : 30 };
    }
    case "open_text": {
      const parsed = openTextSettingsSchema.safeParse(source);
      return parsed.success
        ? { ...DEFAULT_SETTINGS, maxLength: parsed.data.maxLength, showOnDisplay: parsed.data.showOnDisplay }
        : DEFAULT_SETTINGS;
    }
    case "quiz": {
      const parsed = quizSettingsSchema.safeParse(source);
      return { ...DEFAULT_SETTINGS, timerSeconds: parsed.success ? parsed.data.timerSeconds : null };
    }
    case "multiple_choice":
      return DEFAULT_SETTINGS;
  }
}

// ---------------------------------------------------------------------------
// Entrada do builder (speaker)
// ---------------------------------------------------------------------------

export const optionInputSchema = z.object({
  id: z.uuid().optional(),
  label: z.string().trim().min(1, "Preencha todas as alternativas.").max(200),
  isCorrect: z.boolean().default(false),
  points: z.number().int().min(0).max(10000).default(100),
});

const titleSchema = z.string().trim().min(1, "Escreva a pergunta.").max(300, "Pergunta muito longa.");
const descriptionSchema = z.string().trim().max(1000).optional();

export const interactionInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("multiple_choice"),
    title: titleSchema,
    description: descriptionSchema,
    settings: multipleChoiceSettingsSchema,
    options: z.array(optionInputSchema).min(2, "Adicione pelo menos 2 alternativas.").max(8, "Máximo de 8 alternativas."),
  }),
  z.object({
    type: z.literal("rating"),
    title: titleSchema,
    description: descriptionSchema,
    settings: ratingSettingsSchema,
  }),
  z.object({
    type: z.literal("word_cloud"),
    title: titleSchema,
    description: descriptionSchema,
    settings: wordCloudSettingsSchema,
  }),
  z.object({
    type: z.literal("open_text"),
    title: titleSchema,
    description: descriptionSchema,
    settings: openTextSettingsSchema,
  }),
  z.object({
    type: z.literal("quiz"),
    title: titleSchema,
    description: descriptionSchema,
    settings: quizSettingsSchema,
    options: z
      .array(optionInputSchema)
      .min(2, "Adicione pelo menos 2 alternativas.")
      .max(6, "Máximo de 6 alternativas.")
      .refine((options) => options.filter((o) => o.isCorrect).length === 1, {
        error: "Marque exatamente uma alternativa correta.",
      }),
  }),
]);

export type InteractionInput = z.input<typeof interactionInputSchema>;
export type ParsedInteractionInput = z.output<typeof interactionInputSchema>;

// ---------------------------------------------------------------------------
// Visão pública (participante e projetor) — nunca inclui is_correct/points
// ---------------------------------------------------------------------------

export const publicOptionSchema = z.object({ id: z.string(), label: z.string() });

export const publicInteractionSchema = z.object({
  id: z.string(),
  type: interactionTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  position: z.number(),
  settings: normalizedSettingsSchema,
  options: z.array(publicOptionSchema),
  activatedAt: z.string().nullable(),
});

export type PublicOption = z.infer<typeof publicOptionSchema>;
export type PublicInteraction = z.infer<typeof publicInteractionSchema>;

export function toPublicInteraction(
  row: InteractionRow,
  options: readonly InteractionOptionRow[],
): PublicInteraction | null {
  if (!isInteractionType(row.type)) return null;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    position: row.position,
    settings: normalizeSettings(row.type, row.settings),
    options: options
      .filter((o) => o.interaction_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ id: o.id, label: o.label })),
    activatedAt: row.activated_at,
  };
}

// ---------------------------------------------------------------------------
// Resposta do participante
// ---------------------------------------------------------------------------

export const answerPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("multiple_choice"), optionId: z.uuid() }),
  z.object({ type: z.literal("quiz"), optionId: z.uuid() }),
  z.object({ type: z.literal("rating"), value: z.number().int() }),
  z.object({ type: z.literal("word_cloud"), text: z.string().trim().min(1, "Digite uma palavra.").max(50) }),
  z.object({ type: z.literal("open_text"), text: z.string().trim().min(1, "Escreva sua resposta.").max(500) }),
]);

export type AnswerPayload = z.infer<typeof answerPayloadSchema>;

/** Folga para latência de rede no timer do quiz. */
export const QUIZ_GRACE_MS = 2500;

export const currentInteractionResponseSchema = z.object({
  status: z.string(),
  interaction: publicInteractionSchema.nullable(),
  answered: z.boolean(),
});

export type CurrentInteractionResponse = z.infer<typeof currentInteractionResponseSchema>;
