/**
 * Variáveis públicas. Precisam ser lidas com o nome literal para o Next.js
 * conseguir embuti-las no bundle do navegador.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};

export function joinUrl(code: string): string {
  return `${publicEnv.appUrl}/join/${code}`;
}

export function feedbackUrl(sessionId: string): string {
  return `${publicEnv.appUrl}/feedback/${sessionId}`;
}
