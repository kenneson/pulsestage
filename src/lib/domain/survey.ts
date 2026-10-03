import { z } from "zod";

// Pesquisas pós-evento por modelo. Regras puras: tipos, validação e agregação. Sem I/O.

export const QUESTION_KINDS = ["scale", "nps", "choice", "text"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const QUESTION_KIND_META: Record<QuestionKind, { label: string; description: string }> = {
  scale: { label: "Escala 1 a 5", description: "Botões de 1 a 5 com rótulos nas pontas." },
  nps: { label: "Nota 0 a 10", description: "Estilo NPS: o relatório calcula promotores e detratores." },
  choice: { label: "Múltipla escolha", description: "Alternativas definidas por você (inclui sim/não)." },
  text: { label: "Texto livre", description: "Resposta aberta, considerada na análise da IA." },
};

/** Faixa de valores de cada tipo numérico. */
export const RANGE = { scale: { min: 1, max: 5 }, nps: { min: 0, max: 10 } } as const;

// Dimensões alimentam scorecard, pontos fortes/fracos e evolução entre sessões. Mantenha em
// sincronia com o check de survey_template_questions.dimension na migration.
export const DIMENSIONS = [
  "utilidade",
  "satisfacao",
  "recomendacao",
  "clareza",
  "atencao",
  "engajamento",
  "conteudo",
  "aplicabilidade",
  "didatica",
  "relevancia",
  "dominio",
  "organizacao",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  utilidade: "Utilidade",
  satisfacao: "Satisfação",
  recomendacao: "Recomendação",
  clareza: "Clareza",
  atencao: "Atenção",
  engajamento: "Engajamento",
  conteudo: "Conteúdo",
  aplicabilidade: "Aplicabilidade",
  didatica: "Didática",
  relevancia: "Relevância",
  dominio: "Domínio do tema",
  organizacao: "Organização",
};

export const MAX_QUESTIONS = 20;
export const MAX_OPTIONS = 8;
export const TEXT_MAX_LENGTH = 1000;
/** Dimensões consideradas "nota geral" (0–10) no dashboard e na evolução. */
const HEADLINE_DIMENSIONS: readonly Dimension[] = ["utilidade", "satisfacao", "recomendacao"];

export function isQuestionKind(value: unknown): value is QuestionKind {
  return typeof value === "string" && (QUESTION_KINDS as readonly string[]).includes(value);
}

export function isDimension(value: unknown): value is Dimension {
  return typeof value === "string" && (DIMENSIONS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Perguntas
// ---------------------------------------------------------------------------

export type QuestionSettings = { minLabel?: string; maxLabel?: string; options?: string[] };

export type SurveyQuestion = {
  id: string;
  position: number;
  kind: QuestionKind;
  label: string;
  dimension: Dimension | null;
  required: boolean;
  settings: QuestionSettings;
};

const settingsSchema = z.object({
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
  options: z.array(z.string()).optional(),
});

/** Linha do banco (modelo ou cópia da sessão) → pergunta tipada; null se estiver corrompida. */
export function toSurveyQuestion(row: {
  id: string;
  position: number;
  kind: string;
  label: string;
  dimension: string | null;
  required: boolean;
  settings: unknown;
}): SurveyQuestion | null {
  if (!isQuestionKind(row.kind)) return null;
  const settings = settingsSchema.safeParse(row.settings);
  const parsed = settings.success ? settings.data : {};
  if (row.kind === "choice" && (parsed.options?.length ?? 0) < 2) return null;
  return {
    id: row.id,
    position: row.position,
    kind: row.kind,
    label: row.label,
    dimension: (row.kind === "scale" || row.kind === "nps") && isDimension(row.dimension) ? row.dimension : null,
    required: row.required,
    settings: parsed,
  };
}

export function toSurveyQuestions(rows: Parameters<typeof toSurveyQuestion>[0][]): SurveyQuestion[] {
  return rows
    .map(toSurveyQuestion)
    .filter((q): q is SurveyQuestion => q !== null)
    .sort((a, b) => a.position - b.position);
}

// ---------------------------------------------------------------------------
// Rascunho do editor de modelos
// ---------------------------------------------------------------------------

const label = z.string().trim().min(1, "Escreva o texto de todas as perguntas.").max(300, "Pergunta muito longa.");
const endLabel = z.string().trim().max(40, "Rótulo muito longo.").optional();
const dimension = z.enum(DIMENSIONS).nullable();

export const questionDraftSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scale"), label, required: z.boolean(), dimension, minLabel: endLabel, maxLabel: endLabel }),
  z.object({ kind: z.literal("nps"), label, required: z.boolean(), dimension, minLabel: endLabel, maxLabel: endLabel }),
  z.object({
    kind: z.literal("choice"),
    label,
    required: z.boolean(),
    options: z
      .array(z.string().trim().min(1, "Preencha todas as alternativas.").max(80, "Alternativa muito longa."))
      .min(2, "Perguntas de múltipla escolha precisam de pelo menos 2 alternativas.")
      .max(MAX_OPTIONS, `No máximo ${MAX_OPTIONS} alternativas.`),
  }),
  z.object({ kind: z.literal("text"), label, required: z.boolean() }),
]);
export type QuestionDraft = z.infer<typeof questionDraftSchema>;

export const templateDraftSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome ao modelo.").max(120, "Nome muito longo."),
  description: z.string().trim().max(500, "Descrição muito longa.").optional(),
  questions: z
    .array(questionDraftSchema)
    .min(1, "Adicione pelo menos uma pergunta.")
    .max(MAX_QUESTIONS, `No máximo ${MAX_QUESTIONS} perguntas.`),
});
export type TemplateDraft = z.infer<typeof templateDraftSchema>;

/** Rascunho validado → colunas de survey_template_questions (sem template_id). */
export function draftToRows(draft: TemplateDraft) {
  return draft.questions.map((q, index) => {
    const base = { position: index + 1, kind: q.kind, label: q.label, required: q.required };
    switch (q.kind) {
      case "scale":
      case "nps":
        return {
          ...base,
          dimension: q.dimension,
          settings: { ...(q.minLabel ? { minLabel: q.minLabel } : {}), ...(q.maxLabel ? { maxLabel: q.maxLabel } : {}) },
        };
      case "choice":
        return { ...base, dimension: null, settings: { options: q.options } };
      case "text":
        return { ...base, dimension: null, settings: {} };
    }
  });
}

/** Pergunta salva → rascunho editável (para duplicar ou editar um modelo). */
export function questionToDraft(q: SurveyQuestion): QuestionDraft {
  switch (q.kind) {
    case "scale":
    case "nps":
      return {
        kind: q.kind,
        label: q.label,
        required: q.required,
        dimension: q.dimension,
        minLabel: q.settings.minLabel,
        maxLabel: q.settings.maxLabel,
      };
    case "choice":
      return { kind: "choice", label: q.label, required: q.required, options: q.settings.options ?? [] };
    case "text":
      return { kind: "text", label: q.label, required: q.required };
  }
}

// ---------------------------------------------------------------------------
// Respostas do participante
// ---------------------------------------------------------------------------

export type ParsedAnswer = { questionId: string; valueInt: number | null; valueText: string | null };

export const answerFieldName = (questionId: string) => `q_${questionId}`;

/** Valida o formulário contra as perguntas da sessão. Nada vem pronto do cliente. */
export function parseSurveyAnswers(
  questions: readonly SurveyQuestion[],
  read: (field: string) => string | undefined,
): { ok: true; answers: ParsedAnswer[] } | { ok: false; error: string } {
  const answers: ParsedAnswer[] = [];
  for (const q of questions) {
    const raw = read(answerFieldName(q.id))?.trim();
    if (!raw) {
      if (q.required) return { ok: false, error: `Responda: “${q.label}”` };
      continue;
    }
    if (q.kind === "text") {
      if (raw.length > TEXT_MAX_LENGTH) return { ok: false, error: "Resposta muito longa." };
      answers.push({ questionId: q.id, valueInt: null, valueText: raw });
      continue;
    }
    const value = Number(raw);
    const [min, max] =
      q.kind === "choice" ? [0, (q.settings.options?.length ?? 0) - 1] : [RANGE[q.kind].min, RANGE[q.kind].max];
    if (!Number.isInteger(value) || value < min || value > max) {
      return { ok: false, error: `Resposta inválida em “${q.label}”.` };
    }
    answers.push({ questionId: q.id, valueInt: value, valueText: null });
  }
  if (answers.length === 0) return { ok: false, error: "Responda pelo menos uma pergunta." };
  return { ok: true, answers };
}

// ---------------------------------------------------------------------------
// Agregação
// ---------------------------------------------------------------------------

export type AnswerLike = { question_id: string; value_int: number | null; value_text: string | null };

export type QuestionResult =
  | {
      kind: "scale" | "nps";
      question: SurveyQuestion;
      count: number;
      mean: number | null;
      /** só para nps: % promotores (9–10) − % detratores (0–6), de −100 a 100 */
      nps: number | null;
      distribution: { value: number; count: number; pct: number }[];
    }
  | { kind: "choice"; question: SurveyQuestion; count: number; distribution: { label: string; count: number; pct: number }[] }
  | { kind: "text"; question: SurveyQuestion; count: number; texts: string[] };

function mean(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function npsScore(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const promoters = values.filter((v) => v >= 9).length;
  const detractors = values.filter((v) => v <= 6).length;
  return Math.round(((promoters - detractors) / values.length) * 100);
}

function answersByQuestion(answers: readonly AnswerLike[]): Map<string, AnswerLike[]> {
  const map = new Map<string, AnswerLike[]>();
  for (const a of answers) {
    const list = map.get(a.question_id);
    if (list) list.push(a);
    else map.set(a.question_id, [a]);
  }
  return map;
}

export function questionResults(questions: readonly SurveyQuestion[], answers: readonly AnswerLike[]): QuestionResult[] {
  const byQuestion = answersByQuestion(answers);
  return questions.map((question): QuestionResult => {
    const list = byQuestion.get(question.id) ?? [];
    if (question.kind === "text") {
      const texts = list.map((a) => a.value_text?.trim() ?? "").filter((t) => t.length > 0);
      return { kind: "text", question, count: texts.length, texts };
    }
    const values = list.map((a) => a.value_int).filter((v): v is number => typeof v === "number");
    const pct = (count: number) => (values.length > 0 ? count / values.length : 0);
    if (question.kind === "choice") {
      const options = question.settings.options ?? [];
      return {
        kind: "choice",
        question,
        count: values.length,
        distribution: options.map((label, index) => {
          const count = values.filter((v) => v === index).length;
          return { label, count, pct: pct(count) };
        }),
      };
    }
    const { min, max } = RANGE[question.kind];
    const distribution = [];
    for (let v = min; v <= max; v++) {
      const count = values.filter((x) => x === v).length;
      distribution.push({ value: v, count, pct: pct(count) });
    }
    return {
      kind: question.kind,
      question,
      count: values.length,
      mean: mean(values),
      nps: question.kind === "nps" ? npsScore(values) : null,
      distribution,
    };
  });
}

export type DimensionScore = {
  dimension: Dimension;
  label: string;
  kind: "scale" | "nps";
  max: 5 | 10;
  mean: number;
  count: number;
  /** posição relativa na escala (0 = mínimo, 1 = máximo), para comparar 1–5 com 0–10 */
  normalized: number;
};

/** Média de todas as respostas das perguntas marcadas com cada dimensão (separando 1–5 de 0–10). */
export function dimensionScores(questions: readonly SurveyQuestion[], answers: readonly AnswerLike[]): DimensionScore[] {
  const byQuestion = answersByQuestion(answers);
  const groups = new Map<string, { dimension: Dimension; kind: "scale" | "nps"; values: number[] }>();
  for (const q of questions) {
    if (!q.dimension || (q.kind !== "scale" && q.kind !== "nps")) continue;
    const key = `${q.dimension}:${q.kind}`;
    const group = groups.get(key) ?? { dimension: q.dimension, kind: q.kind, values: [] };
    for (const a of byQuestion.get(q.id) ?? []) if (typeof a.value_int === "number") group.values.push(a.value_int);
    groups.set(key, group);
  }
  const scores: DimensionScore[] = [];
  for (const g of groups.values()) {
    const m = mean(g.values);
    if (m === null) continue;
    const { min, max } = RANGE[g.kind];
    scores.push({
      dimension: g.dimension,
      label: DIMENSION_LABEL[g.dimension],
      kind: g.kind,
      max: g.kind === "scale" ? 5 : 10,
      mean: m,
      count: g.values.length,
      normalized: (m - min) / (max - min),
    });
  }
  return scores.sort((a, b) => b.normalized - a.normalized);
}

/**
 * Pontos mais e menos bem avaliados da sessão, relativos entre si. Só com 3+ dimensões
 * (com 2 ou menos, "forte" e "fraco" seriam a mesma comparação).
 */
export function strengthsAndWeaknesses(scores: readonly DimensionScore[], minAnswers = 3) {
  const ranked = scores.filter((s) => s.count >= minAnswers).sort((a, b) => b.normalized - a.normalized);
  if (ranked.length < 3) return { strengths: [], weaknesses: [] };
  const take = ranked.length >= 4 ? 2 : 1;
  return { strengths: ranked.slice(0, take), weaknesses: ranked.slice(-take).reverse() };
}

/** Nota geral 0–10: média das dimensões de utilidade/satisfação/recomendação em 0–10. */
export function headlineScore(scores: readonly DimensionScore[]): number | null {
  return mean(scores.filter((s) => s.kind === "nps" && HEADLINE_DIMENSIONS.includes(s.dimension)).map((s) => s.mean));
}

/** Média das dimensões em escala 1–5. */
export function scaleAverage(scores: readonly DimensionScore[]): number | null {
  return mean(scores.filter((s) => s.kind === "scale").map((s) => s.mean));
}
