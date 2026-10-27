// Retorno do login com Google que chegou fora de /auth/callback. Regra pura (sem I/O).
//
// Quando o endereço de retorno pedido (redirectTo) não está liberado nas Redirect URLs do Supabase Auth,
// o Supabase cai no Site URL: o navegador volta para a página inicial com ?code=... (ou ?error=...).
// Sem este desvio, o código nunca é trocado pela sessão e a pessoa fica na landing sem entrar.

/** Caminhos onde o Site URL pode cair: a raiz e as versões com prefixo de idioma. */
const LANDING_PATHS = new Set(["/", "/es", "/en"]);

/**
 * Para onde mandar um retorno de OAuth que chegou à página inicial; null quando não é o caso.
 * Com `code`, segue para a troca em /auth/callback (o painel é o destino padrão); com `error`, volta
 * ao login com o aviso do Google.
 */
export function oauthReturnTarget(pathname: string, params: URLSearchParams): string | null {
  if (!LANDING_PATHS.has(pathname)) return null;
  const code = params.get("code");
  if (code) {
    const target = new URLSearchParams({ code, next: "/dashboard" });
    return `/auth/callback?${target.toString()}`;
  }
  if (params.has("error") && (params.has("error_description") || params.has("error_code"))) {
    return "/login?error=google";
  }
  return null;
}
