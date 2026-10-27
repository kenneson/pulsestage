import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isLocalizablePath, LOCALE_COOKIE, LOCALE_HEADER, splitLocalePrefix } from "@/lib/domain/locale";
import { oauthReturnTarget } from "@/lib/domain/oauth-return";

// Next.js 16: "proxy" substitui "middleware". Em Next 15, renomeie para middleware.ts
// e a função para `middleware`.

const AUTH_PATHS = ["/dashboard", "/login", "/signup", "/oauth"];
const needsAuth = (path: string) => AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function proxy(request: NextRequest) {
  // Login com Google que voltou para a página inicial (Site URL do Supabase): segue para a troca do código.
  const oauthTarget = oauthReturnTarget(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (oauthTarget) return NextResponse.redirect(new URL(oauthTarget, request.url));

  const { locale, path } = splitLocalePrefix(request.nextUrl.pathname);
  if (!locale) return updateSession(request);

  // /es/... e /en/...: a mesma página, no idioma do prefixo. A escolha fica no cookie para os links
  // sem prefixo (painel, sessão) seguirem no mesmo idioma.
  const target = request.nextUrl.clone();
  target.pathname = path;
  let response: NextResponse;
  if (!isLocalizablePath(path)) {
    response = NextResponse.redirect(target);
  } else {
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, locale);
    response = needsAuth(path)
      ? await updateSession(request, { rewrite: target, headers })
      : NextResponse.rewrite(target, { request: { headers } });
  }
  response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/signup",
    "/oauth/:path*",
    "/es",
    "/es/:path*",
    "/en",
    "/en/:path*",
    // Página inicial só com retorno de OAuth (?code= ou ?error=); as demais visitas não passam pelo proxy.
    { source: "/", has: [{ type: "query", key: "code" }] },
    { source: "/", has: [{ type: "query", key: "error" }] },
  ],
};
