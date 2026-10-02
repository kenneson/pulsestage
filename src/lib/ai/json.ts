import { insightOutputSchema, type InsightOutput } from "./schema";
import { AIProviderError } from "./types";

/** Extrai e valida o JSON da resposta do modelo (tolera cercas de markdown). */
export function parseInsightOutput(raw: string): InsightOutput {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new AIProviderError("A IA não retornou JSON.");

  let json: unknown;
  try {
    json = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new AIProviderError("A IA retornou um JSON inválido.");
  }

  const parsed = insightOutputSchema.safeParse(json);
  if (!parsed.success) throw new AIProviderError("A IA retornou um formato inesperado.");
  return parsed.data;
}
