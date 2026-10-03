import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/action-result";

/** Confirmação de e-mail e retorno do login com Google (PKCE): troca o code pela sessão. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // OAuth cancelado ou recusado volta com ?error=...; sem code e sem erro é link de e-mail inválido.
  const reason = searchParams.has("error") ? "google" : "confirmacao";
  return NextResponse.redirect(`${origin}/login?error=${reason}`);
}
