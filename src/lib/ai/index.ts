import "server-only";
import { serverEnv } from "@/lib/env.server";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { parseInsightOutput } from "./json";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import { buildQuestionsPrompt, parseQuestionSuggestions, QUESTIONS_SYSTEM_PROMPT, type QuestionsInput } from "./questions";
import type { InsightOutput } from "./schema";
import type { AIProvider, InsightInput } from "./types";
import type { ParsedInteractionInput } from "@/lib/domain/interactions";

// Modelos padrão: sobrescreva com AI_MODEL quando quiser outro. Provedores aposentam modelos:
// se aparecer "modelo não encontrado", confira a lista atual do provedor (Groq: GET /openai/v1/models).
const DEFAULT_MODELS = {
  groq: "openai/gpt-oss-120b",
  openai: "gpt-4.1-mini",
  anthropic: "claude-sonnet-5-5",
} as const;

type ProviderName = keyof typeof DEFAULT_MODELS;

/** Aceita "Groq", " groq " etc. */
function providerName(value: string | undefined): ProviderName | null {
  const name = value?.toLowerCase();
  return name === "groq" || name === "openai" || name === "anthropic" ? name : null;
}

/**
 * O que falta na configuração da IA, em português e sem revelar a chave; null = configurada.
 * Mostrado no analytics para o speaker saber qual variável ajustar.
 */
export function aiConfigProblem(): string | null {
  const env = serverEnv();
  if (!env.AI_PROVIDER && !env.AI_API_KEY) return "Faltam as variáveis AI_PROVIDER e AI_API_KEY.";
  if (!env.AI_PROVIDER) return "Falta a variável AI_PROVIDER (groq, openai ou anthropic).";
  if (!providerName(env.AI_PROVIDER)) {
    return `AI_PROVIDER está como "${env.AI_PROVIDER.slice(0, 30)}": use groq, openai ou anthropic.`;
  }
  if (!env.AI_API_KEY) return "Falta a variável AI_API_KEY (a chave do provedor).";
  return null;
}

/** Retorna o provider configurado, ou null quando não há credenciais (o app segue funcionando). */
export function getAIProvider(): AIProvider | null {
  const env = serverEnv();
  const provider = providerName(env.AI_PROVIDER);
  if (!provider || !env.AI_API_KEY) return null;
  // AI_MODEL com o nome do provedor (ex.: "groq") é engano comum: usa o modelo padrão.
  const model = env.AI_MODEL && !providerName(env.AI_MODEL) ? env.AI_MODEL : DEFAULT_MODELS[provider];

  switch (provider) {
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
    return aiConfigProblem() === null;
  } catch {
    return false;
  }
}

export async function generateInsights(provider: AIProvider, input: InsightInput): Promise<InsightOutput> {
  return parseInsightOutput(await provider.complete(SYSTEM_PROMPT, buildUserPrompt(input), { temperature: 0.2 }));
}

/** Perguntas sugeridas para o roteiro, já validadas com o schema do builder. */
export async function suggestInteractions(provider: AIProvider, input: QuestionsInput): Promise<ParsedInteractionInput[]> {
  // Temperatura mais alta: "Gerar outras sugestões" precisa de variedade.
  const raw = await provider.complete(QUESTIONS_SYSTEM_PROMPT, buildQuestionsPrompt(input), { temperature: 0.8 });
  return parseQuestionSuggestions(raw, [...input.existing, ...input.avoid]);
}
