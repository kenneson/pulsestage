import "server-only";
import { serverEnv } from "@/lib/env.server";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import type { AIProvider } from "./types";

// Modelos padrão: sobrescreva com AI_MODEL quando quiser outro. Provedores aposentam modelos:
// se aparecer "modelo não encontrado", confira a lista atual do provedor (Groq: GET /openai/v1/models).
const DEFAULT_MODELS = {
  groq: "openai/gpt-oss-120b",
  openai: "gpt-4.1-mini",
  anthropic: "claude-sonnet-5-5",
} as const;

/** Retorna o provider configurado, ou null quando não há credenciais (o app segue funcionando). */
export function getAIProvider(): AIProvider | null {
  const env = serverEnv();
  if (!env.AI_PROVIDER || !env.AI_API_KEY) return null;
  const model = env.AI_MODEL ?? DEFAULT_MODELS[env.AI_PROVIDER];

  switch (env.AI_PROVIDER) {
    case "groq":
      return new OpenAICompatibleProvider("groq", model, "https://api.groq.com/openai/v1", env.AI_API_KEY);
    case "openai":
      return new OpenAICompatibleProvider("openai", model, "https://api.openai.com/v1", env.AI_API_KEY);
    case "anthropic":
      return new AnthropicProvider(model, env.AI_API_KEY);
  }
}

export function isAIConfigured(): boolean {
  try {
    return getAIProvider() !== null;
  } catch {
    return false;
  }
}
