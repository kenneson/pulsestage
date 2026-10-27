import { z } from "zod";
import {
  buildInteractionInput,
  defaultSettings,
  hasOptions,
  INTERACTION_TYPES,
  interactionInputSchema,
  interactionTypeSchema,
  optionsFromLabels,
  type AnswerKey,
  type InteractionInput,
  type InteractionType,
  type NormalizedSettings,
  type ParsedInteractionInput,
} from "../domain/interactions.ts";
import { extractJson } from "./json.ts";
import { AIProviderError } from "./types.ts";
import { LOCALE_AI_NAME, type Locale } from "../domain/locale.ts";

/** O que a IA recebe para sugerir perguntas: só o que o speaker escreveu, nada da plateia. */
export type QuestionsInput = {
  title: string;
  description: string | null;
  durationMinutes: number | null;
  /** Perguntas que já estão no roteiro. */
  existing: string[];
  /** Sugestões já mostradas, para "Gerar outras sugestões" não repetir. */
  avoid: string[];
};

export const QUESTIONS_SYSTEM_PROMPT = `Você ajuda palestrantes e professores a preparar perguntas que a plateia responde pelo celular durante a apresentação.

Crie 5 perguntas para a sessão descrita, no idioma da sessão indicado na mensagem (padrão: português do Brasil). Escreva perguntas, alternativas e rótulos nesse idioma; as chaves do JSON e os valores de "type" ficam como estão:
1. Varie os tipos: "multiple_choice" (enquete, 2 a 5 alternativas, sem resposta certa), "quiz" (2 a 4 alternativas, exatamente uma correta), "rating" (escala de 1 a 5), "word_cloud" (resposta de uma ou duas palavras), "open_text" (resposta livre curta) e "ranking" (a plateia ordena 3 a 5 alternativas por prioridade). Quando fizer sentido, use também: "points_100" (cada pessoa distribui 100 pontos entre 3 a 5 alternativas, para mostrar o peso de cada uma), "matrix_2x2" (a plateia posiciona 2 a 5 itens em dois eixos, como esforço × impacto), "guess_number" (a plateia chuta um número; só com um número real, conhecido e indiscutível) e "quiz_text" (a plateia digita uma resposta curta, de uma ou duas palavras, sem ambiguidade). No máximo uma de cada um desses quatro.
2. Misture quebra-gelo, checagem de entendimento e reflexão sobre como aplicar o tema.
3. Perguntas com até 120 caracteres, claras para ler no projetor. Alternativas com até 60 caracteres.
4. No quiz, use apenas fatos corretos e amplamente aceitos sobre o tema. Sem certeza, prefira uma enquete.
5. Não repita nem parafraseie as perguntas de "existing" e "avoid".
6. Não peça dados pessoais (nome, e-mail, telefone, empresa).

Responda APENAS com um objeto JSON, sem markdown, exatamente neste formato:
{ "questions": [{ "type": "multiple_choice" | "quiz" | "rating" | "word_cloud" | "open_text" | "ranking" | "points_100" | "matrix_2x2" | "guess_number" | "quiz_text", "title": "...", "options": ["..."], "correct_option": 0, "min_label": "...", "max_label": "...", "x_label": "...", "x_low": "...", "x_high": "...", "y_label": "...", "y_low": "...", "y_high": "...", "number_min": 0, "number_max": 100, "correct_number": 42, "unit": "...", "accepted_answers": ["..."] }] }
"options" só em multiple_choice, quiz, ranking, points_100 e matrix_2x2 (os itens a posicionar). "correct_option" só em quiz: índice da alternativa correta, começando em 0. "min_label" e "max_label" (até 30 caracteres) só em rating. "x_label"/"y_label" (nome de cada eixo) e "x_low"/"x_high"/"y_low"/"y_high" (rótulos das pontas), até 30 caracteres, só em matrix_2x2. "number_min", "number_max", "correct_number" (entre os dois) e "unit" (opcional, até 10 caracteres) só em guess_number. "accepted_answers" (1 a 5 formas aceitas da resposta, até 40 caracteres) só em quiz_text.`;

export function buildQuestionsPrompt(input: QuestionsInput, locale: Locale = "pt-BR"): string {
  return `Idioma da sessão: ${LOCALE_AI_NAME[locale]}.\n\nSessão (JSON):\n${JSON.stringify(input)}`;
}

/** Tipos que a IA sugere: sem imagem (pin_image) e sem slide de conteúdo. */
export const SUGGESTED_TYPES: readonly InteractionType[] = INTERACTION_TYPES.filter((t) => t !== "pin_image" && t !== "content");

const label = z.string().nullish();
const suggestionSchema = z.object({
  type: interactionTypeSchema.refine((t) => SUGGESTED_TYPES.includes(t)),
  title: z.string(),
  options: z.array(z.string()).default([]),
  correct_option: z.number().int().nullish(),
  min_label: label,
  max_label: label,
  x_label: label,
  x_low: label,
  x_high: label,
  y_label: label,
  y_low: label,
  y_high: label,
  number_min: z.number().finite().nullish(),
  number_max: z.number().finite().nullish(),
  correct_number: z.number().finite().nullish(),
  unit: label,
  accepted_answers: z.array(z.string()).nullish(),
})
  // Sem o número certo, o "Adivinhe o número" não tem como pontuar (o builder poria o mínimo da faixa).
  .refine((s) => s.type !== "guess_number" || typeof s.correct_number === "number");
type Suggestion = z.infer<typeof suggestionSchema>;

const orNull = (value: string | null | undefined) => (value ? value : null);

function answerKeyOf(s: Suggestion): AnswerKey | null {
  if (s.type === "guess_number") return { value: s.correct_number ?? Number.NaN };
  if (s.type === "quiz_text") return { accepted: s.accepted_answers ?? [] };
  return null;
}

// Mesmos padrões do formulário e do MCP (defaultSettings): a sugestão vira uma pergunta como outra qualquer.
// O schema do builder decide o resto (faixa do número, respostas aceitas, alternativas).
function toInput(s: Suggestion): InteractionInput {
  const defaults = defaultSettings(s.type);
  const settings: NormalizedSettings =
    s.type === "rating"
      ? { ...defaults, minLabel: orNull(s.min_label), maxLabel: orNull(s.max_label) }
      : s.type === "matrix_2x2"
        ? {
            ...defaults,
            xLabel: orNull(s.x_label),
            xLow: orNull(s.x_low),
            xHigh: orNull(s.x_high),
            yLabel: orNull(s.y_label),
            yLow: orNull(s.y_low),
            yHigh: orNull(s.y_high),
          }
        : s.type === "guess_number"
          ? {
              ...defaults,
              numMin: s.number_min ?? defaults.numMin,
              numMax: s.number_max ?? defaults.numMax,
              // Número com casas decimais: aceita até 2.
              decimals: [s.number_min, s.number_max, s.correct_number].some((n) => typeof n === "number" && !Number.isInteger(n)) ? 2 : 0,
              unit: orNull(s.unit),
            }
          : defaults;
  return buildInteractionInput({
    type: s.type,
    title: s.title,
    settings,
    options: hasOptions(s.type) ? optionsFromLabels(s.type, s.options, s.correct_option) : [],
    answerKey: answerKeyOf(s),
  });
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();

/** Valida cada sugestão com o schema do builder; descarta as inválidas e as repetidas. */
export function parseQuestionSuggestions(raw: string, known: readonly string[]): ParsedInteractionInput[] {
  const json = z.object({ questions: z.array(z.unknown()).max(12) }).safeParse(extractJson(raw));
  if (!json.success) throw new AIProviderError("A IA retornou um formato inesperado.");

  const seen = new Set(known.map(normalize));
  const result: ParsedInteractionInput[] = [];
  for (const item of json.data.questions) {
    const suggestion = suggestionSchema.safeParse(item);
    if (!suggestion.success) continue;
    const parsed = interactionInputSchema.safeParse(toInput(suggestion.data));
    if (!parsed.success) continue;
    const key = normalize(parsed.data.title);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(parsed.data);
  }
  if (result.length === 0) throw new AIProviderError("A IA não trouxe perguntas válidas. Tente gerar de novo.");
  return result;
}
