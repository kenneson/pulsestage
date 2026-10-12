import { resolveAppUrl } from "@/lib/domain/app-url";

/**
 * Variáveis públicas. Precisam ser lidas com o nome literal para o Next.js
 * conseguir embuti-las no bundle do navegador.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  // A integração Supabase ↔ Vercel cria NEXT_PUBLIC_SUPABASE_ANON_KEY; aceitamos as duas.
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  // QR Code e links de entrada: nunca um endereço de deploy protegido por login da Vercel
  // (regras em lib/domain/app-url.ts). VERCEL_PROJECT_PRODUCTION_URL existe no servidor da Vercel.
  appUrl: resolveAppUrl({
    explicit: process.env.NEXT_PUBLIC_APP_URL,
    productionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  }),
};

export function joinUrl(code: string): string {
  return `${publicEnv.appUrl}/join/${code}`;
}

export function feedbackUrl(sessionId: string): string {
  return `${publicEnv.appUrl}/feedback/${sessionId}`;
}
