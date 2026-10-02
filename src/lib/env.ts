/**
 * Variáveis públicas. Precisam ser lidas com o nome literal para o Next.js
 * conseguir embuti-las no bundle do navegador.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  // A integração Supabase ↔ Vercel cria NEXT_PUBLIC_SUPABASE_ANON_KEY; aceitamos as duas.
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  ).replace(/\/$/, ""),
};

export function joinUrl(code: string): string {
  return `${publicEnv.appUrl}/join/${code}`;
}

export function feedbackUrl(sessionId: string): string {
  return `${publicEnv.appUrl}/feedback/${sessionId}`;
}
