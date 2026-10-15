import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/action-result";
import type { Database } from "./database.types";

const AUTH_PAGES = ["/login", "/signup"];

type Options = {
  /** URL sem o prefixo de idioma (/es/login → /login), servida no lugar da original. */
  rewrite?: URL;
  /** Cabeçalhos repassados à página (ex.: o idioma do prefixo). */
  headers?: Headers;
};

/** Renova a sessão do Supabase e protege /dashboard. */
export async function updateSession(request: NextRequest, options: Options = {}) {
  const forward = { request: { headers: options.headers ?? request.headers } };
  const pass = () => (options.rewrite ? NextResponse.rewrite(options.rewrite, forward) : NextResponse.next(forward));
  let response = pass();

  const supabase = createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
          options.headers?.set("cookie", request.headers.get("cookie") ?? "");
        }
        response = pass();
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = options.rewrite?.pathname ?? request.nextUrl.pathname;

  if (!user && path.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && AUTH_PAGES.includes(path)) {
    // Já logado: segue para onde ia (ex.: consentimento de um assistente de IA) ou para o painel.
    const next = new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.nextUrl.origin);
    return NextResponse.redirect(next);
  }

  return response;
}
