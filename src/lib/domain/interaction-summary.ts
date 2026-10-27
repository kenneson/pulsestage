// Resumo de cada interação para o analytics, o relatório (PDF), o CSV, o MCP e a IA. Regras puras (sem I/O).
// Recebe a linha da interação, as alternativas e as respostas brutas (já filtradas, se houver "comparar grupos")
// e devolve números; quem mostra formata no idioma de quem lê.

import { z } from "zod";
import {
  isInteractionType,
  normalizeSettings,
  parseGuessAnswerKey,
  parseQuizTextAnswerKey,
  type InteractionType,
  type NormalizedSettings,
} from "./interactions.ts";
import {
  matrixPoints,
  optionBars,
  pinHeat,
  pointsBars,
  ratingStats,
  snapshotFromResponses,
  wordList,
  type ResultsSnapshot,
  type WordCount,
} from "./results.ts";
import { rankingResults } from "./ranking.ts";
import { average, parseQuizValue } from "./metrics.ts";

export type SummaryResponse = {
  id: string;
  participant_id: string;
  aggregate_key: string | null;
  value: unknown;
  created_at: string;
  moderation?: string;
};

export type SummaryInteraction = {
  id: string;
  type: string;
  title: string;
  settings: unknown;
  answer_key?: unknown;
};

export type SummaryOption = { id: string; label: string; position: number; is_correct: boolean; image_path?: string | null };

export type ChoiceRow = { key: string; label: string; count: number; pct: number; correct: boolean };

export type InteractionSummary =
  | { kind: "choice"; total: number; multi: boolean; rows: ChoiceRow[] }
  | {
      kind: "quiz";
      total: number;
      rows: ChoiceRow[];
      correctRate: number | null;
      avgResponseMs: number | null;
    }
  | { kind: "rating"; total: number; min: number; max: number; mean: number | null; median: number | null }
  | { kind: "words"; total: number; words: WordCount[] }
  | { kind: "texts"; total: number; texts: string[] }
  | { kind: "ranking"; total: number; rows: { key: string; label: string; averagePosition: number | null }[] }
  | { kind: "points"; total: number; rows: { key: string; label: string; average: number }[] }
  | {
      kind: "matrix";
      total: number;
      rows: { key: string; label: string; x: number; y: number; count: number }[];
      axes: Pick<NormalizedSettings, "xLabel" | "yLabel" | "xLow" | "xHigh" | "yLow" | "yHigh">;
    }
  | { kind: "pin"; total: number; hotspots: { x: number; y: number; count: number }[] }
  | {
      kind: "guess";
      total: number;
      mean: number | null;
      median: number | null;
      /** número certo (gabarito; só o dono vê) */
      answer: number | null;
      /** chegou a 90% ou mais de proximidade (o mesmo "Acertou!" do celular) */
      hitRate: number | null;
      avgPoints: number | null;
      /** chute mais perto do número certo */
      closest: number | null;
      unit: string | null;
      decimals: number;
    }
  | {
      kind: "quizText";
      total: number;
      correctRate: number | null;
      avgResponseMs: number | null;
      accepted: string[];
      /** respostas mais comuns (agrupadas pela forma normalizada), com o texto mais digitado de cada grupo */
      answers: { key: string; text: string; count: number; correct: boolean }[];
    }
  | { kind: "content" };

const guessValueSchema = z.object({ value: z.number() });
const quizTextValueSchema = z.object({ text: z.string(), normalized: z.string().optional(), isCorrect: z.boolean().optional() });
const choiceValueSchema = z.object({ optionId: z.string().optional(), optionIds: z.array(z.string()).optional() });
const pointsValueSchema = z.object({ allocations: z.record(z.string(), z.number()) });
const matrixValueSchema = z.object({ positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })) });
const pinValueSchema = z.object({ x: z.number(), y: z.number() });
const rankingValueSchema = z.object({ order: z.array(z.string()) });
const scalarValueSchema = z.object({ value: z.number().optional(), text: z.string().optional() });

const visible = (r: SummaryResponse) => r.moderation === undefined || r.moderation === "visible";

function ratio(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Alternativas da própria interação, na ordem do roteiro. */
function sortedOptions(options: readonly SummaryOption[]): SummaryOption[] {
  return [...options].sort((a, b) => a.position - b.position);
}

function choiceRows(options: readonly SummaryOption[], snapshot: ResultsSnapshot): ChoiceRow[] {
  const pub = options.map((o) => ({ id: o.id, label: o.label, imagePath: o.image_path ?? null }));
  return optionBars(pub, snapshot).map((b) => ({
    ...b,
    correct: options.find((o) => o.id === b.key)?.is_correct ?? false,
  }));
}

/** Respostas mais comuns do quiz de digitar, agrupadas pela forma normalizada (só as visíveis). */
export function quizTextAnswers(responses: readonly SummaryResponse[], limit = 8): { key: string; text: string; count: number; correct: boolean }[] {
  const groups = new Map<string, { count: number; correct: boolean; spellings: Map<string, number> }>();
  for (const r of responses) {
    if (!visible(r)) continue;
    const parsed = quizTextValueSchema.safeParse(r.value);
    if (!parsed.success) continue;
    const key = parsed.data.normalized ?? r.aggregate_key ?? parsed.data.text.trim().toLowerCase();
    if (!key) continue;
    const group = groups.get(key) ?? { count: 0, correct: false, spellings: new Map<string, number>() };
    group.count += 1;
    group.correct ||= parsed.data.isCorrect === true;
    const spelling = parsed.data.text.trim();
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const text = [...g.spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? key;
      return { key, text, count: g.count, correct: g.correct };
    })
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, limit);
}

/** Estatísticas dos chutes do "Adivinhe o número" (pelos valores gravados, não pelos baldes). */
export function guessSummary(
  responses: readonly SummaryResponse[],
  settings: Pick<NormalizedSettings, "unit" | "decimals">,
  answerKey: unknown,
): Extract<InteractionSummary, { kind: "guess" }> {
  const values: number[] = [];
  const scored = responses.map((r) => parseQuizValue(r.value)).filter((v) => v !== null);
  for (const r of responses) {
    const parsed = guessValueSchema.safeParse(r.value);
    if (parsed.success && Number.isFinite(parsed.data.value)) values.push(parsed.data.value);
  }
  const answer = parseGuessAnswerKey(answerKey)?.value ?? null;
  let closest: number | null = null;
  if (answer !== null) {
    for (const v of values) if (closest === null || Math.abs(v - answer) < Math.abs(closest - answer)) closest = v;
  }
  return {
    kind: "guess",
    total: responses.length,
    mean: average(values),
    median: median(values),
    answer,
    hitRate: ratio(scored.filter((v) => v.isCorrect).length, scored.length),
    avgPoints: average(scored.map((v) => v.points)),
    closest,
    unit: settings.unit,
    decimals: settings.decimals,
  };
}

/** Pontos mais marcados na imagem (centro da célula, 0–1), do mais para o menos marcado. */
function pinHotspots(snapshot: ResultsSnapshot, limit = 3) {
  const heat = pinHeat(snapshot);
  return [...heat.cells]
    .sort((a, b) => b.count - a.count || a.gy - b.gy || a.gx - b.gx)
    .slice(0, limit)
    .map((c) => ({ x: (c.gx + 0.5) / heat.grid, y: (c.gy + 0.5) / heat.grid, count: c.count }));
}

export function summarizeInteraction(
  interaction: SummaryInteraction,
  options: readonly SummaryOption[],
  responses: readonly SummaryResponse[],
): InteractionSummary | null {
  if (!isInteractionType(interaction.type)) return null;
  const type: InteractionType = interaction.type;
  const settings = normalizeSettings(type, interaction.settings);
  const opts = sortedOptions(options);
  const snapshot = snapshotFromResponses(responses);
  const total = responses.length;
  switch (type) {
    case "multiple_choice":
      return { kind: "choice", total, multi: settings.maxChoices > 1, rows: choiceRows(opts, snapshot) };
    case "quiz": {
      const values = responses.map((r) => parseQuizValue(r.value)).filter((v) => v !== null);
      return {
        kind: "quiz",
        total,
        rows: choiceRows(opts, snapshot),
        correctRate: ratio(values.filter((v) => v.isCorrect).length, values.length),
        avgResponseMs: average(values.map((v) => v.responseTimeMs)),
      };
    }
    case "rating": {
      const stats = ratingStats(settings.min, settings.max, snapshot);
      return { kind: "rating", total, min: settings.min, max: settings.max, mean: stats.mean, median: stats.median };
    }
    case "word_cloud":
      return { kind: "words", total, words: wordList(snapshot, 20) };
    case "open_text":
      return { kind: "texts", total, texts: snapshot.recent.map((e) => e.text) };
    case "ranking":
      return {
        kind: "ranking",
        total,
        rows: rankingResults(opts, snapshot).map((r) => ({ key: r.key, label: r.label, averagePosition: r.averagePosition })),
      };
    case "points_100":
      return {
        kind: "points",
        total,
        rows: pointsBars(
          opts.map((o) => ({ id: o.id, label: o.label, imagePath: null })),
          snapshot,
        ).map((b) => ({ key: b.key, label: b.label, average: b.average })),
      };
    case "matrix_2x2":
      return {
        kind: "matrix",
        total,
        rows: matrixPoints(
          opts.map((o) => ({ id: o.id, label: o.label, imagePath: null })),
          snapshot,
        ).map((p) => ({ key: p.key, label: p.label, x: p.x, y: p.y, count: p.count })),
        axes: {
          xLabel: settings.xLabel,
          yLabel: settings.yLabel,
          xLow: settings.xLow,
          xHigh: settings.xHigh,
          yLow: settings.yLow,
          yHigh: settings.yHigh,
        },
      };
    case "pin_image":
      return { kind: "pin", total, hotspots: pinHotspots(snapshot) };
    case "guess_number":
      return guessSummary(responses, settings, interaction.answer_key);
    case "quiz_text": {
      const values = responses.map((r) => parseQuizValue(r.value)).filter((v) => v !== null);
      return {
        kind: "quizText",
        total,
        correctRate: ratio(values.filter((v) => v.isCorrect).length, values.length),
        avgResponseMs: average(values.map((v) => v.responseTimeMs)),
        accepted: parseQuizTextAnswerKey(interaction.answer_key)?.accepted ?? [],
        answers: quizTextAnswers(responses),
      };
    }
    case "content":
      return { kind: "content" };
  }
}

// ---------------------------------------------------------------------------
// Resposta de uma pessoa, legível (CSV)
// ---------------------------------------------------------------------------

/** Número com até `decimals` casas, ponto ou vírgula conforme o separador decimal pedido. */
export function plainNumber(value: number, decimals = 2, decimal: "," | "." = ","): string {
  const factor = 10 ** decimals;
  return String(Math.round(value * factor) / factor).replace(".", decimal);
}

/**
 * Uma resposta em texto: enquete "A" (várias: "A · B"), ranking "A > B", 100 pontos "A: 70 · B: 30",
 * matriz "A (x 80, y 20) · B (x 10, y 90)", pin "x 42%, y 18%", número com a unidade, textos como vieram.
 * Escala e número saem como número (o CSV formata o decimal).
 */
export function readableAnswer(
  type: string,
  value: unknown,
  options: readonly { id: string; label: string }[],
  settings?: Pick<NormalizedSettings, "unit">,
  decimal: "," | "." = ",",
): string | number | null {
  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? "?";
  // Ordem das alternativas (não a do JSON gravado), para colunas comparáveis entre pessoas.
  const inOrder = <T>(record: Record<string, T>) =>
    Object.entries(record).sort(
      ([a], [b]) => options.findIndex((o) => o.id === a) - options.findIndex((o) => o.id === b),
    );
  switch (type) {
    case "multiple_choice":
    case "quiz": {
      const parsed = choiceValueSchema.safeParse(value);
      if (!parsed.success) return null;
      if (parsed.data.optionIds) {
        const ids = parsed.data.optionIds;
        return options.filter((o) => ids.includes(o.id)).map((o) => o.label).join(" · ") || null;
      }
      return parsed.data.optionId ? labelOf(parsed.data.optionId) : null;
    }
    case "ranking": {
      const parsed = rankingValueSchema.safeParse(value);
      return parsed.success ? parsed.data.order.map(labelOf).join(" > ") : null;
    }
    case "points_100": {
      const parsed = pointsValueSchema.safeParse(value);
      if (!parsed.success) return null;
      return inOrder(parsed.data.allocations)
        .map(([id, points]) => `${labelOf(id)}: ${points}`)
        .join(" · ");
    }
    case "matrix_2x2": {
      const parsed = matrixValueSchema.safeParse(value);
      if (!parsed.success) return null;
      return inOrder(parsed.data.positions)
        .map(([id, p]) => `${labelOf(id)} (x ${Math.round(p.x)}, y ${Math.round(p.y)})`)
        .join(" · ");
    }
    case "pin_image": {
      const parsed = pinValueSchema.safeParse(value);
      return parsed.success ? `x ${Math.round(parsed.data.x * 100)}%, y ${Math.round(parsed.data.y * 100)}%` : null;
    }
    case "guess_number": {
      const parsed = guessValueSchema.safeParse(value);
      if (!parsed.success) return null;
      return settings?.unit ? `${plainNumber(parsed.data.value, 2, decimal)} ${settings.unit}` : parsed.data.value;
    }
    default: {
      const parsed = scalarValueSchema.safeParse(value);
      if (!parsed.success) return null;
      return parsed.data.text ?? parsed.data.value ?? null;
    }
  }
}
