import { insightOutputSchema, type InsightOutput } from "./schema.ts";
import { AIProviderError } from "./types.ts";

/** Extrai o objeto JSON da resposta do modelo (tolera cercas de markdown e texto em volta). */
export function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AIProviderError("A IA não retornou JSON.");

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new AIProviderError("A IA retornou um JSON inválido.");
  }
}

export function parseInsightOutput(raw: string): InsightOutput {
  const parsed = insightOutputSchema.safeParse(extractJson(raw));
  if (!parsed.success) throw new AIProviderError("A IA retornou um formato inesperado.");
  return parsed.data;
}
