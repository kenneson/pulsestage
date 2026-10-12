// Endereço público do app, usado no QR Code, no link de entrada e no da pesquisa. Regra pura.
//
// Na Vercel, cada deploy e cada branch ganham um endereço próprio (*.vercel.app) protegido por login
// da Vercel ("Deployment Protection"): quem escaneia o QR cai na tela de login em vez da sessão.
// Por isso, um NEXT_PUBLIC_APP_URL que aponte para um desses endereços é trocado pelo domínio de
// produção, que é público. Domínios próprios (ex.: pulsestage.com.br) são respeitados.

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Garante o https:// (sem ele, o leitor de QR trata o texto como busca) e tira a barra final. */
function normalize(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function resolveAppUrl({
  explicit,
  productionHost,
  fallback = "http://localhost:3000",
}: {
  /** NEXT_PUBLIC_APP_URL */
  explicit?: string | null;
  /** VERCEL_PROJECT_PRODUCTION_URL (só o host, ex.: pulsestage.vercel.app) */
  productionHost?: string | null;
  fallback?: string;
}): string {
  const production = productionHost?.trim() ? normalize(productionHost) : null;
  const chosen = explicit?.trim() ? normalize(explicit) : null;
  if (!chosen) return production ?? fallback;

  const host = hostOf(chosen);
  if (production && host && host.endsWith(".vercel.app") && host !== hostOf(production)) return production;
  return chosen;
}
