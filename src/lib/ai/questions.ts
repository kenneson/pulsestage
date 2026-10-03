import { z } from "zod";
import {
  interactionInputSchema,
  interactionTypeSchema,
  type InteractionInput,
  type ParsedInteractionInput,
} from "../domain/interactions.ts";
import { extractJson } from "./json.ts";
import { AIProviderError } from "./types.ts";

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

Crie 5 perguntas para a sessão descrita, em português do Brasil:
1. Varie os tipos: "multiple_choice" (enquete, 2 a 5 alternativas, sem resposta certa), "quiz" (2 a 4 alternativas, exatamente uma correta), "rating" (escala de 1 a 5), "word_cloud" (resposta de uma ou duas palavras) e "open_text" (resposta livre curta).
2. Misture quebra-gelo, checagem de entendimento e reflexão sobre como aplicar o tema.
3. Perguntas com até 120 caracteres, claras para ler no projetor. Alternativas com até 60 caracteres.
4. No quiz, use apenas fatos corretos e amplamente aceitos sobre o tema. Sem certeza, prefira uma enquete.
5. Não repita nem parafraseie as perguntas de "existing" e "avoid".
6. Não peça dados pessoais (nome, e-mail, telefone, empresa).

Responda APENAS com um objeto JSON, sem markdown, exatamente neste formato:
{ "questions": [{ "type": "multiple_choice" | "quiz" | "rating" | "word_cloud" | "open_text", "title": "...", "options": ["..."], "correct_option": 0, "min_label": "...", "max_label": "..." }] }
"options" só em multiple_choice e quiz. "correct_option" só em quiz: índice da alternativa correta, começando em 0. "min_label" e "max_label" (até 30 caracteres) só em rating.`;

export function buildQuestionsPrompt(input: QuestionsInput): string {
  return `Sessão (JSON):\n${JSON.stringify(input)}`;
}

const suggestionSchema = z.object({
  type: interactionTypeSchema,
  title: z.string(),
  options: z.array(z.string()).default([]),
  correct_option: z.number().int().nullish(),
  min_label: z.string().nullish(),
  max_label: z.string().nullish(),
});
type Suggestion = z.infer<typeof suggestionSchema>;

// Mesmos defaults do formulário (emptyDraft): a sugestão vira uma pergunta como outra qualquer.
function toInput(s: Suggestion): InteractionInput {
  const base = { title: s.title };
  switch (s.type) {
    case "multiple_choice":
      return { type: "multiple_choice", ...base, settings: {}, options: s.options.map((label) => ({ label })) };
    case "quiz":
      return {
        type: "quiz",
        ...base,
        settings: { timerSeconds: 30 },
        options: s.options.map((label, index) => ({ label, isCorrect: index === s.correct_option, points: 100 })),
      };
    case "rating":
      return {
        type: "rating",
        ...base,
        settings: { min: 1, max: 5, minLabel: s.min_label ?? undefined, maxLabel: s.max_label ?? undefined },
      };
    case "word_cloud":
      return { type: "word_cloud", ...base, settings: { maxLength: 30 } };
    case "open_text":
      return { type: "open_text", ...base, settings: { maxLength: 280, showOnDisplay: true } };
  }
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
