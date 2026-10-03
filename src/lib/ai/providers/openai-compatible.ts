import "server-only";
import { z } from "zod";
import { AIProviderError, providerErrorMessage, type AIProvider } from "../types";

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

  async complete(system: string, user: string, { temperature }: { temperature: number }): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) throw new AIProviderError(providerErrorMessage(res.status, this.name, this.model));
    const parsed = responseSchema.safeParse(await res.json());
    const content = parsed.success ? parsed.data.choices[0]?.message.content : null;
    if (!content) throw new AIProviderError("Resposta vazia do provedor de IA.");
    return content;
  }
}
