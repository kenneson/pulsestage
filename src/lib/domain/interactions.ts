import { z } from "zod";
import type { InteractionOptionRow, InteractionRow } from "@/lib/supabase/types";
import { optionImagePathSchema, optionStyleSchema } from "./gamification.ts";
import { toEmbedUrl } from "./content.ts";
import { messageKey } from "./message-key.ts";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export const INTERACTION_TYPES = [
  "multiple_choice",
  "rating",
  "word_cloud",
  "open_text",
  "quiz",
  "ranking",
  "points_100",
  "matrix_2x2",
  "pin_image",
  "guess_number",
  "quiz_text",
  "content",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];
export const interactionTypeSchema = z.enum(INTERACTION_TYPES);

export function isInteractionType(value: string): value is InteractionType {
  return (INTERACTION_TYPES as readonly string[]).includes(value);
}

export type OptionType = "multiple_choice" | "quiz" | "ranking" | "points_100" | "matrix_2x2";

/** Tipos com alternativas (em matriz 2×2, os itens a posicionar). */
export function hasOptions(type: InteractionType): type is OptionType {
  return (
    type === "multiple_choice" || type === "quiz" || type === "ranking" || type === "points_100" || type === "matrix_2x2"
  );
}

/** Enquete e quiz podem ter alternativas com forma e cor ou em grade de imagens. */
export function hasOptionStyle(type: InteractionType): type is "multiple_choice" | "quiz" {
  return type === "multiple_choice" || type === "quiz";
}

/** Tipos que dão pontos (entram no ranking do quiz e mostram "Acertou!" no celular). */
export const SCORED_TYPES = ["quiz", "quiz_text", "guess_number"] as const satisfies readonly InteractionType[];
export type ScoredType = (typeof SCORED_TYPES)[number];

export function isScoredType(type: InteractionType): type is ScoredType {
  return (SCORED_TYPES as readonly string[]).includes(type);
}

/** Slide de conteúdo não recebe resposta; todo o resto sim. */
export function acceptsResponses(type: InteractionType): boolean {
  return type !== "content";
}

/** Cronômetro vale para todo tipo que recebe resposta. */
export function supportsTimer(type: InteractionType): boolean {
  return acceptsResponses(type);
}

/** Tipos com gabarito privado (interactions.answer_key). */
export function hasAnswerKey(type: InteractionType): type is "guess_number" | "quiz_text" {
  return type === "guess_number" || type === "quiz_text";
}

// Rótulos em português para MCP e IA (a tela usa domain.interactionTypes.<tipo> nos três idiomas).
export const INTERACTION_TYPE_META: Record<InteractionType, { label: string; description: string }> = {
  multiple_choice: { label: "Enquete", description: "Uma escolha entre alternativas (ou várias, com limite)." },
  rating: { label: "Escala", description: "Nota em uma escala, como 1 a 5." },
  word_cloud: { label: "Nuvem de palavras", description: "Respostas curtas agrupadas por frequência." },
  open_text: { label: "Pergunta aberta", description: "Resposta livre em uma frase." },
  quiz: { label: "Quiz", description: "Pergunta com resposta correta e pontuação." },
  ranking: { label: "Ranking", description: "A plateia ordena as alternativas por preferência." },
  points_100: { label: "100 pontos", description: "Cada pessoa distribui 100 pontos entre as alternativas." },
  matrix_2x2: { label: "Matriz 2×2", description: "Cada pessoa posiciona os itens em dois eixos (ex.: esforço × impacto)." },
  pin_image: { label: "Marcar na imagem", description: "Cada pessoa toca num ponto da imagem; o telão mostra o mapa de calor." },
  guess_number: { label: "Adivinhe o número", description: "Cada pessoa chuta um número; quem chega mais perto ganha mais pontos." },
  quiz_text: { label: "Quiz de digitar", description: "A pessoa digita a resposta; variações de escrita contam como certas." },
  content: { label: "Slide de conteúdo", description: "Título, texto, imagem ou vídeo no telão, sem resposta." },
};

// ---------------------------------------------------------------------------
// Settings (JSONB) — um schema por tipo
// ---------------------------------------------------------------------------

const timerSchema = z.number().int().min(5).max(300).nullable().default(null);
const shortLabelSchema = z.string().trim().max(40).optional();

/** Ajustes que valem para todo tipo que recebe resposta. */
const commonSettings = {
  /** cronômetro; depois do tempo (com folga) o servidor recusa respostas */
  timerSeconds: timerSchema,
  /** o telão só mostra os resultados depois de "Revelar resultados" */
  hideResults: z.boolean().default(false),
  /** depois de responder, o celular mostra o gráfico ao vivo (nunca em tipos que pontuam) */
  showResultsOnPhone: z.boolean().default(false),
};

export const multipleChoiceSettingsSchema = z.object({
  ...commonSettings,
  /** "shapes": alternativas com forma e cor, como no Kahoot; "images": grade de imagens */
  optionStyle: optionStyleSchema.default("text"),
  /** 1 = uma escolha; mais = múltipla escolha com limite */
  maxChoices: z.number().int().min(1).max(8).default(1),
  /** pergunta de perfil, usada para comparar grupos (filtro no telão e no analytics) */
  isSegment: z.boolean().default(false),
});

export const ratingSettingsSchema = z
  .object({
    ...commonSettings,
    min: z.number().int().min(0).max(1).default(1),
    max: z.number().int().min(2).max(10).default(5),
    minLabel: shortLabelSchema,
    maxLabel: shortLabelSchema,
  })
  .refine((s) => s.min < s.max, { error: "validation.minBelowMax" });

export const wordCloudSettingsSchema = z.object({
  ...commonSettings,
  maxLength: z.number().int().min(5).max(50).default(30),
});

export const openTextSettingsSchema = z.object({
  ...commonSettings,
  maxLength: z.number().int().min(20).max(500).default(280),
  showOnDisplay: z.boolean().default(true),
});

export const quizSettingsSchema = z.object({
  ...commonSettings,
  optionStyle: optionStyleSchema.default("text"),
  /** quem responde antes ganha mais (só com tempo limite) */
  speedBonus: z.boolean().default(false),
});

/** Ranking: as alternativas bastam. */
export const rankingSettingsSchema = z.object({ ...commonSettings });

export const points100SettingsSchema = z.object({ ...commonSettings });

export const matrixSettingsSchema = z.object({
  ...commonSettings,
  /** nome de cada eixo (ex.: "Esforço") e o rótulo das pontas (ex.: "Baixo"/"Alto") */
  xLabel: shortLabelSchema,
  yLabel: shortLabelSchema,
  xLow: shortLabelSchema,
  xHigh: shortLabelSchema,
  yLow: shortLabelSchema,
  yHigh: shortLabelSchema,
});

export const pinImageSettingsSchema = z.object({
  ...commonSettings,
  imagePath: optionImagePathSchema,
});

const numberSchema = z.number().finite().min(-1e9).max(1e9);

export const guessNumberSettingsSchema = z
  .object({
    ...commonSettings,
    numMin: numberSchema.default(0),
    numMax: numberSchema.default(100),
    decimals: z.number().int().min(0).max(2).default(0),
    unit: z.string().trim().max(10).optional(),
    /** pontos de quem acerta em cheio (cai com a distância) */
    maxPoints: z.number().int().min(0).max(10000).default(100),
  })
  .refine((s) => s.numMin < s.numMax, { error: "validation.minBelowMax" });

export const quizTextSettingsSchema = z.object({
  ...commonSettings,
  /** pontos de quem acerta (com bônus de velocidade, caem até a metade) */
  maxPoints: z.number().int().min(0).max(10000).default(100),
  speedBonus: z.boolean().default(false),
  maxLength: z.number().int().min(5).max(60).default(60),
});

export const CONTENT_BODY_MAX = 2000;

export const contentSettingsSchema = z.object({
  body: z.string().trim().max(CONTENT_BODY_MAX, "validation.contentTooLong").default(""),
  imagePath: optionImagePathSchema.nullish(),
  /** YouTube ou Vimeo (o endereço é convertido para o player com `toEmbedUrl`) */
  videoUrl: z
    .string()
    .trim()
    .max(300)
    .refine((url) => url === "" || toEmbedUrl(url) !== null, { error: "validation.videoUrl" })
    .optional(),
});

/** Settings achatados com defaults, usados pela UI e pelas regras de resposta. Nada aqui é segredo. */
export const normalizedSettingsSchema = z.object({
  min: z.number(),
  max: z.number(),
  minLabel: z.string().nullable(),
  maxLabel: z.string().nullable(),
  maxLength: z.number(),
  showOnDisplay: z.boolean(),
  timerSeconds: z.number().nullable(),
  optionStyle: optionStyleSchema,
  speedBonus: z.boolean(),
  hideResults: z.boolean(),
  showResultsOnPhone: z.boolean(),
  maxChoices: z.number(),
  isSegment: z.boolean(),
  xLabel: z.string().nullable(),
  yLabel: z.string().nullable(),
  xLow: z.string().nullable(),
  xHigh: z.string().nullable(),
  yLow: z.string().nullable(),
  yHigh: z.string().nullable(),
  imagePath: z.string().nullable(),
  body: z.string(),
  videoUrl: z.string().nullable(),
  numMin: z.number(),
  numMax: z.number(),
  decimals: z.number(),
  unit: z.string().nullable(),
  /** pontos máximos do adivinhe o número e do quiz de digitar (não é segredo: a pontuação é pública no ranking) */
  maxPoints: z.number(),
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
  optionStyle: "text",
  speedBonus: false,
  hideResults: false,
  showResultsOnPhone: false,
  maxChoices: 1,
  isSegment: false,
  xLabel: null,
  yLabel: null,
  xLow: null,
  xHigh: null,
  yLow: null,
  yHigh: null,
  imagePath: null,
  body: "",
  videoUrl: null,
  numMin: 0,
  numMax: 100,
  decimals: 0,
  unit: null,
  maxPoints: 100,
};

const orNull = (value: string | null | undefined) => (value ? value : null);

type CommonParsed = { timerSeconds: number | null; hideResults: boolean; showResultsOnPhone: boolean };

function withCommon(s: CommonParsed): NormalizedSettings {
  return { ...DEFAULT_SETTINGS, timerSeconds: s.timerSeconds, hideResults: s.hideResults, showResultsOnPhone: s.showResultsOnPhone };
}

export function normalizeSettings(type: InteractionType, raw: unknown): NormalizedSettings {
  const source = raw ?? {};
  switch (type) {
    case "rating": {
      const parsed = ratingSettingsSchema.safeParse(source);
      if (!parsed.success) return DEFAULT_SETTINGS;
      return {
        ...withCommon(parsed.data),
        min: parsed.data.min,
        max: parsed.data.max,
        minLabel: orNull(parsed.data.minLabel),
        maxLabel: orNull(parsed.data.maxLabel),
      };
    }
    case "word_cloud": {
      const parsed = wordCloudSettingsSchema.safeParse(source);
      return parsed.success ? { ...withCommon(parsed.data), maxLength: parsed.data.maxLength } : { ...DEFAULT_SETTINGS, maxLength: 30 };
    }
    case "open_text": {
      const parsed = openTextSettingsSchema.safeParse(source);
      return parsed.success
        ? { ...withCommon(parsed.data), maxLength: parsed.data.maxLength, showOnDisplay: parsed.data.showOnDisplay }
        : DEFAULT_SETTINGS;
    }
    case "quiz": {
      const parsed = quizSettingsSchema.safeParse(source);
      return parsed.success
        ? { ...withCommon(parsed.data), optionStyle: parsed.data.optionStyle, speedBonus: parsed.data.speedBonus }
        : DEFAULT_SETTINGS;
    }
    case "multiple_choice": {
      const parsed = multipleChoiceSettingsSchema.safeParse(source);
      return parsed.success
        ? {
            ...withCommon(parsed.data),
            optionStyle: parsed.data.optionStyle,
            maxChoices: parsed.data.maxChoices,
            isSegment: parsed.data.isSegment,
          }
        : DEFAULT_SETTINGS;
    }
    case "ranking": {
      const parsed = rankingSettingsSchema.safeParse(source);
      return parsed.success ? withCommon(parsed.data) : DEFAULT_SETTINGS;
    }
    case "points_100": {
      const parsed = points100SettingsSchema.safeParse(source);
      return parsed.success ? withCommon(parsed.data) : DEFAULT_SETTINGS;
    }
    case "matrix_2x2": {
      const parsed = matrixSettingsSchema.safeParse(source);
      if (!parsed.success) return DEFAULT_SETTINGS;
      const s = parsed.data;
      return {
        ...withCommon(s),
        xLabel: orNull(s.xLabel),
        yLabel: orNull(s.yLabel),
        xLow: orNull(s.xLow),
        xHigh: orNull(s.xHigh),
        yLow: orNull(s.yLow),
        yHigh: orNull(s.yHigh),
      };
    }
    case "pin_image": {
      const parsed = pinImageSettingsSchema.safeParse(source);
      return parsed.success ? { ...withCommon(parsed.data), imagePath: parsed.data.imagePath } : DEFAULT_SETTINGS;
    }
    case "guess_number": {
      const parsed = guessNumberSettingsSchema.safeParse(source);
      if (!parsed.success) return DEFAULT_SETTINGS;
      const s = parsed.data;
      return {
        ...withCommon(s),
        numMin: s.numMin,
        numMax: s.numMax,
        decimals: s.decimals,
        unit: orNull(s.unit),
        maxPoints: s.maxPoints,
      };
    }
    case "quiz_text": {
      const parsed = quizTextSettingsSchema.safeParse(source);
      return parsed.success
        ? {
            ...withCommon(parsed.data),
            maxPoints: parsed.data.maxPoints,
            speedBonus: parsed.data.speedBonus,
            maxLength: parsed.data.maxLength,
          }
        : { ...DEFAULT_SETTINGS, maxLength: 60 };
    }
    case "content": {
      const parsed = contentSettingsSchema.safeParse(source);
      if (!parsed.success) return DEFAULT_SETTINGS;
      return {
        ...DEFAULT_SETTINGS,
        body: parsed.data.body,
        imagePath: parsed.data.imagePath ?? null,
        videoUrl: orNull(parsed.data.videoUrl),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Entrada do builder (speaker)
// ---------------------------------------------------------------------------

export const optionInputSchema = z.object({
  id: z.uuid().optional(),
  label: z.string().trim().min(1, "validation.fillAllOptions").max(200),
  isCorrect: z.boolean().default(false),
  points: z.number().int().min(0).max(10000).default(100),
  /** imagem no bucket option-images; o texto continua obrigatório (vira o texto alternativo) */
  imagePath: optionImagePathSchema.nullish(),
});

const titleSchema = z.string().trim().min(1, "validation.questionRequired").max(300, "validation.questionTooLong");
const descriptionSchema = z.string().trim().max(1000).optional();
/** Notas do palestrante (só ele vê, na sala ao vivo). */
export const NOTES_MAX = 2000;
const notesSchema = z.string().trim().max(NOTES_MAX, "validation.notesTooLong").optional();

const base = { title: titleSchema, description: descriptionSchema, notes: notesSchema };

/** Gabarito do "Adivinhe o número". */
export const guessAnswerKeySchema = z.object({ value: numberSchema });
/** Respostas aceitas do "Quiz de digitar" (a comparação ignora maiúsculas, acentos e espaços). */
export const ACCEPTED_ANSWERS_MAX = 10;
export const quizTextAnswerKeySchema = z.object({
  accepted: z
    .array(z.string().trim().min(1, "validation.acceptedRequired").max(60))
    .min(1, "validation.acceptedRequired")
    .max(ACCEPTED_ANSWERS_MAX, messageKey("validation.acceptedMax", { max: ACCEPTED_ANSWERS_MAX })),
});

/** Alternativa com imagem obrigatória no estilo grade de imagens. */
function imagesHaveFiles(style: string, options: readonly { imagePath?: string | null }[]): boolean {
  return style !== "images" || options.every((o) => Boolean(o.imagePath));
}

export const interactionInputSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("multiple_choice"),
      ...base,
      settings: multipleChoiceSettingsSchema,
      options: z.array(optionInputSchema).min(2, "validation.atLeastTwoOptions").max(8, "validation.maxEightOptions"),
    })
    .refine((i) => i.settings.maxChoices <= i.options.length, { error: "validation.maxChoicesTooHigh" })
    .refine((i) => imagesHaveFiles(i.settings.optionStyle, i.options), { error: "validation.imagesRequired" }),
  z.object({ type: z.literal("rating"), ...base, settings: ratingSettingsSchema }),
  z.object({ type: z.literal("word_cloud"), ...base, settings: wordCloudSettingsSchema }),
  z.object({ type: z.literal("open_text"), ...base, settings: openTextSettingsSchema }),
  z
    .object({
      type: z.literal("quiz"),
      ...base,
      settings: quizSettingsSchema,
      options: z
        .array(optionInputSchema)
        .min(2, "validation.atLeastTwoOptions")
        .max(6, "validation.maxSixOptions")
        .refine((options) => options.filter((o) => o.isCorrect).length === 1, {
          error: "validation.exactlyOneCorrect",
        }),
    })
    .refine((i) => imagesHaveFiles(i.settings.optionStyle, i.options), { error: "validation.imagesRequired" }),
  z.object({
    type: z.literal("ranking"),
    ...base,
    settings: rankingSettingsSchema,
    options: z.array(optionInputSchema).min(2, "validation.atLeastTwoOptions").max(8, "validation.maxEightOptions"),
  }),
  z.object({
    type: z.literal("points_100"),
    ...base,
    settings: points100SettingsSchema,
    options: z.array(optionInputSchema).min(2, "validation.atLeastTwoOptions").max(8, "validation.maxEightOptions"),
  }),
  z.object({
    type: z.literal("matrix_2x2"),
    ...base,
    settings: matrixSettingsSchema,
    options: z.array(optionInputSchema).min(1, "validation.atLeastOneItem").max(8, "validation.maxEightOptions"),
  }),
  z.object({ type: z.literal("pin_image"), ...base, settings: pinImageSettingsSchema }),
  z
    .object({
      type: z.literal("guess_number"),
      ...base,
      settings: guessNumberSettingsSchema,
      answerKey: guessAnswerKeySchema,
    })
    .refine((i) => i.answerKey.value >= i.settings.numMin && i.answerKey.value <= i.settings.numMax, {
      error: "validation.answerOutOfRange",
    }),
  z.object({
    type: z.literal("quiz_text"),
    ...base,
    settings: quizTextSettingsSchema,
    answerKey: quizTextAnswerKeySchema,
  }),
  z.object({ type: z.literal("content"), ...base, settings: contentSettingsSchema }),
]);

export type InteractionInput = z.input<typeof interactionInputSchema>;
export type ParsedInteractionInput = z.output<typeof interactionInputSchema>;
export type OptionInput = z.input<typeof optionInputSchema>;
export type AnswerKey = z.infer<typeof guessAnswerKeySchema> | z.infer<typeof quizTextAnswerKeySchema>;

/** Gabarito da entrada já validada (o que vai para interactions.answer_key). */
export function answerKeyOf(input: ParsedInteractionInput): AnswerKey | null {
  return input.type === "guess_number" || input.type === "quiz_text" ? input.answerKey : null;
}

export function parseGuessAnswerKey(raw: unknown): z.infer<typeof guessAnswerKeySchema> | null {
  const parsed = guessAnswerKeySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseQuizTextAnswerKey(raw: unknown): z.infer<typeof quizTextAnswerKeySchema> | null {
  const parsed = quizTextAnswerKeySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Padrões de uma pergunta nova (painel, sugestões da IA e MCP usam os mesmos)
// ---------------------------------------------------------------------------

/** Tempo do quiz novo, em segundos. */
export const DEFAULT_QUIZ_TIMER_SECONDS = 30;
/** Pontos de quem acerta, por alternativa. */
export const DEFAULT_OPTION_POINTS = 100;
/** Alternativas de uma pergunta nova com alternativas. */
export const DEFAULT_OPTION_COUNT = 2;

/**
 * Ajustes de uma pergunta nova. Diferente de `DEFAULT_SETTINGS` (leitura de linhas antigas, sem o campo):
 * o quiz (e o quiz de digitar) já nasce no estilo jogo (tempo e bônus de velocidade); a enquete continua em texto.
 */
export function defaultSettings(type: InteractionType): NormalizedSettings {
  const game = type === "quiz" || type === "quiz_text";
  return {
    ...DEFAULT_SETTINGS,
    maxLength: type === "word_cloud" ? 30 : type === "quiz_text" ? 60 : 280,
    timerSeconds: game ? DEFAULT_QUIZ_TIMER_SECONDS : null,
    optionStyle: type === "quiz" ? "shapes" : "text",
    speedBonus: game,
    maxPoints: DEFAULT_OPTION_POINTS,
  };
}

/** Alternativa nova; no quiz, a primeira já vem marcada como correta. */
export function defaultOption(isCorrect = false): { label: string; isCorrect: boolean; points: number; imagePath: null } {
  return { label: "", isCorrect, points: DEFAULT_OPTION_POINTS, imagePath: null };
}

/** Alternativas a partir dos textos; `correctIndex` (base 0) só vale no quiz. */
export function optionsFromLabels(type: InteractionType, labels: readonly string[], correctIndex?: number | null): OptionInput[] {
  return labels.map((label, index) => ({
    label,
    isCorrect: type === "quiz" && index === correctIndex,
    points: DEFAULT_OPTION_POINTS,
  }));
}

export type InteractionParts = {
  type: InteractionType;
  title: string;
  description?: string;
  notes?: string;
  settings: NormalizedSettings;
  options: OptionInput[];
  /** guess_number: { value }; quiz_text: { accepted } */
  answerKey?: AnswerKey | null;
};

/** Monta a entrada do builder: só os ajustes que valem para o tipo (o resto dos settings achatados fica de fora). */
export function buildInteractionInput({ type, title, description, notes, settings: s, options, answerKey }: InteractionParts): InteractionInput {
  const head = { title, description, ...(notes !== undefined ? { notes } : {}) };
  const common = { timerSeconds: s.timerSeconds, hideResults: s.hideResults, showResultsOnPhone: s.showResultsOnPhone };
  const optional = (value: string | null) => value ?? undefined;
  switch (type) {
    case "multiple_choice":
      return {
        type,
        ...head,
        settings: { ...common, optionStyle: s.optionStyle, maxChoices: s.maxChoices, isSegment: s.isSegment },
        options,
      };
    case "quiz":
      return {
        type,
        ...head,
        // Bônus de velocidade só existe com tempo para responder.
        settings: { ...common, optionStyle: s.optionStyle, speedBonus: s.speedBonus && s.timerSeconds !== null },
        options,
      };
    case "rating":
      return {
        type,
        ...head,
        settings: { ...common, min: s.min, max: s.max, minLabel: optional(s.minLabel), maxLabel: optional(s.maxLabel) },
      };
    case "word_cloud":
      return { type, ...head, settings: { ...common, maxLength: s.maxLength } };
    case "open_text":
      return { type, ...head, settings: { ...common, maxLength: s.maxLength, showOnDisplay: s.showOnDisplay } };
    case "ranking":
      return { type, ...head, settings: common, options };
    case "points_100":
      return { type, ...head, settings: common, options };
    case "matrix_2x2":
      return {
        type,
        ...head,
        settings: {
          ...common,
          xLabel: optional(s.xLabel),
          yLabel: optional(s.yLabel),
          xLow: optional(s.xLow),
          xHigh: optional(s.xHigh),
          yLow: optional(s.yLow),
          yHigh: optional(s.yHigh),
        },
        options,
      };
    case "pin_image":
      return { type, ...head, settings: { ...common, imagePath: s.imagePath ?? "" } };
    case "guess_number":
      return {
        type,
        ...head,
        settings: { ...common, numMin: s.numMin, numMax: s.numMax, decimals: s.decimals, unit: optional(s.unit), maxPoints: s.maxPoints },
        answerKey: answerKey && "value" in answerKey ? answerKey : { value: s.numMin },
      };
    case "quiz_text":
      return {
        type,
        ...head,
        settings: { ...common, maxPoints: s.maxPoints, speedBonus: s.speedBonus && s.timerSeconds !== null, maxLength: s.maxLength },
        answerKey: answerKey && "accepted" in answerKey ? answerKey : { accepted: [] },
      };
    case "content":
      return {
        type,
        ...head,
        settings: { body: s.body, imagePath: s.imagePath, videoUrl: optional(s.videoUrl) },
      };
  }
}

/** Pergunta nova do tipo, sem texto: ponto de partida do formulário, da IA e do MCP. */
export function defaultInteractionInput(type: InteractionType): InteractionInput {
  return buildInteractionInput({
    type,
    title: "",
    settings: defaultSettings(type),
    options: hasOptions(type)
      ? Array.from({ length: DEFAULT_OPTION_COUNT }, (_, index) => defaultOption(type === "quiz" && index === 0))
      : [],
  });
}

// ---------------------------------------------------------------------------
// Visão pública (participante e projetor) — nunca inclui is_correct/points/answer_key/notas
// ---------------------------------------------------------------------------

export const publicOptionSchema = z.object({ id: z.string(), label: z.string(), imagePath: z.string().nullable() });

export const publicInteractionSchema = z.object({
  id: z.string(),
  type: interactionTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  position: z.number(),
  settings: normalizedSettingsSchema,
  options: z.array(publicOptionSchema),
  activatedAt: z.string().nullable(),
  /** lacuna do deck (depois de quantos slides); null = no fim */
  afterSlide: z.number().nullable(),
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
      .map((o) => ({ id: o.id, label: o.label, imagePath: o.image_path })),
    activatedAt: row.activated_at,
    afterSlide: row.after_slide,
  };
}

// ---------------------------------------------------------------------------
// Resposta do participante
// ---------------------------------------------------------------------------

/** Pontos a distribuir no "100 pontos". */
export const POINTS_BUDGET = 100;

const coordinateSchema = z.number().int().min(0).max(100);

export const answerPayloadSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("multiple_choice"),
      /** uma escolha */
      optionId: z.uuid().optional(),
      /** várias escolhas (maxChoices > 1) */
      optionIds: z.array(z.uuid()).min(1, "validation.chooseAtLeastOne").max(8).optional(),
    })
    .refine((p) => (p.optionId === undefined) !== (p.optionIds === undefined), { error: "validation.chooseAtLeastOne" }),
  z.object({ type: z.literal("quiz"), optionId: z.uuid() }),
  z.object({ type: z.literal("rating"), value: z.number().int() }),
  z.object({ type: z.literal("word_cloud"), text: z.string().trim().min(1, "validation.wordRequired").max(50) }),
  z.object({ type: z.literal("open_text"), text: z.string().trim().min(1, "validation.answerRequired").max(500) }),
  z.object({ type: z.literal("ranking"), order: z.array(z.uuid()).min(2, "validation.rankAllOptions").max(8) }),
  z.object({
    type: z.literal("points_100"),
    allocations: z.record(z.uuid(), z.number().int().min(0).max(POINTS_BUDGET)),
  }),
  z.object({
    type: z.literal("matrix_2x2"),
    positions: z.record(z.uuid(), z.object({ x: coordinateSchema, y: coordinateSchema })),
  }),
  z.object({ type: z.literal("pin_image"), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  z.object({ type: z.literal("guess_number"), value: numberSchema }),
  z.object({ type: z.literal("quiz_text"), text: z.string().trim().min(1, "validation.answerRequired").max(60) }),
]);

export type AnswerPayload = z.infer<typeof answerPayloadSchema>;

/** Folga para latência de rede no timer do quiz. */
export const QUIZ_GRACE_MS = 2500;

/** Recursos da sessão que aparecem no celular fora das perguntas do roteiro. */
export const participantFeaturesSchema = z.object({ questions: z.boolean(), reactions: z.boolean() });
export type ParticipantFeatures = z.infer<typeof participantFeaturesSchema>;

export const currentInteractionResponseSchema = z.object({
  status: z.string(),
  interaction: publicInteractionSchema.nullable(),
  answered: z.boolean(),
  features: participantFeaturesSchema.default({ questions: false, reactions: false }),
  /** 'self' = ritmo próprio: o celular percorre o roteiro inteiro (GET /api/participant/[id]/journey) */
  pace: z.enum(["live", "self"]).default("live"),
});

export type CurrentInteractionResponse = z.infer<typeof currentInteractionResponseSchema>;
