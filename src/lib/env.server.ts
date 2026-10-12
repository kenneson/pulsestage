import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY não configurada"),
  PARTICIPANT_TOKEN_SECRET: z.string().min(32, "PARTICIPANT_TOKEN_SECRET precisa ter 32+ caracteres"),
  // Validado em lib/ai (um valor errado aqui não pode derrubar o resto do app).
  AI_PROVIDER: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

/** Lê e valida as variáveis do servidor (espaços nas pontas são removidos; vazias contam como ausentes). */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const raw = {
    // A integração Supabase ↔ Vercel cria SUPABASE_SERVICE_ROLE_KEY; aceitamos as duas.
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    PARTICIPANT_TOKEN_SECRET: process.env.PARTICIPANT_TOKEN_SECRET,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
  };
  const cleaned = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => {
      const trimmed = value?.trim();
      return [key, trimmed === "" ? undefined : trimmed];
    }),
  );
  cached = schema.parse(cleaned);
  return cached;
}
