import "server-only";
import { z } from "zod";
import { AIProviderError, providerErrorMessage, type AIProvider } from "../types";

const responseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  constructor(
    readonly model: string,
    private readonly apiKey: string,
  ) {}

  async complete(system: string, user: string, { temperature }: { temperature: number }): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2000,
        temperature,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) throw new AIProviderError(providerErrorMessage(res.status, "anthropic", this.model));
    const parsed = responseSchema.safeParse(await res.json());
    const text = parsed.success
      ? parsed.data.content
          .filter((block) => block.type === "text")
          .map((block) => block.text ?? "")
          .join("")
      : "";
    if (!text) throw new AIProviderError("Resposta vazia do provedor de IA.");
    return text;
  }
}
