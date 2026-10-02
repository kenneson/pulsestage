import "server-only";
import { z } from "zod";
import { buildUserPrompt, SYSTEM_PROMPT } from "../prompt";
import { parseInsightOutput } from "../json";
import { AIProviderError, type AIProvider, type InsightInput } from "../types";
import type { InsightOutput } from "../schema";

const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

/** Funciona com qualquer API compatível com OpenAI Chat Completions (OpenAI, Groq...). */
export class OpenAICompatibleProvider implements AIProvider {
  constructor(
    readonly name: string,
    readonly model: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async generateInsights(input: InsightInput): Promise<InsightOutput> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) throw new AIProviderError(`O provedor de IA respondeu com erro ${res.status}.`);
    const parsed = responseSchema.safeParse(await res.json());
    const content = parsed.success ? parsed.data.choices[0]?.message.content : null;
    if (!content) throw new AIProviderError("Resposta vazia do provedor de IA.");
    return parseInsightOutput(content);
  }
}
