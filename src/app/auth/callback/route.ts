import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/action-result";
import { isValidTimeZone } from "@/lib/datetime";
import { LOCALE_COOKIE, localeOrDefault } from "@/lib/domain/locale";
import { getRequestLocale } from "@/i18n/locale.server";

const NEW_ACCOUNT_MS = 10 * 60 * 1000;
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Confirmação de e-mail e retorno do login com Google (PKCE): troca o code pela sessão. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      const user = data.user;
      const isNew = Date.now() - Date.parse(user.created_at) < NEW_ACCOUNT_MS;
      if (isNew && user.app_metadata.provider !== "email") {
        // Conta nova pelo Google: o perfil nasce no idioma desta visita e no fuso do navegador.
        const tz = request.cookies.get("ps_signup_tz")?.value;
        await supabase
          .from("profiles")
          .update({ locale: await getRequestLocale(), ...(tz && isValidTimeZone(tz) ? { time_zone: tz } : {}) })
          .eq("id", user.id);
        response.cookies.delete("ps_signup_tz");
      } else {
        // Login: o painel segue o idioma do perfil.
        const { data: profile } = await supabase.from("profiles").select("locale").eq("id", user.id).maybeSingle();
        if (profile) {
          response.cookies.set(LOCALE_COOKIE, localeOrDefault(profile.locale), { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
        }
      }
      return response;
    }
  }

  // OAuth cancelado ou recusado volta com ?error=...; sem code e sem erro é link de e-mail inválido.
  const reason = searchParams.has("error") ? "google" : "confirmacao";
  return NextResponse.redirect(`${origin}/login?error=${reason}`);
}
