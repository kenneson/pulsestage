import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/lib/domain/locale";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Grava o idioma escolhido no cookie (vale para as próximas páginas sem prefixo). */
export async function setLocaleCookie(locale: Locale): Promise<void> {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
}
