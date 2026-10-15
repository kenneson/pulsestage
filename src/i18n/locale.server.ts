import "server-only";
import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  matchAcceptLanguage,
  toLocale,
  type Locale,
} from "@/lib/domain/locale";

/**
 * Idioma da requisição: prefixo da URL (/es, /en, gravado pelo proxy) → cookie (escolha da pessoa ou do
 * perfil, gravado no login) → Accept-Language do navegador → português.
 * Páginas da plateia (celular e telão) usam o idioma da sessão, não este (ver SessionIntl).
 */
export async function getRequestLocale(): Promise<Locale> {
  const h = await headers();
  const fromPrefix = toLocale(h.get(LOCALE_HEADER));
  if (fromPrefix) return fromPrefix;
  const fromCookie = toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  if (fromCookie) return fromCookie;
  return matchAcceptLanguage(h.get("accept-language")) ?? DEFAULT_LOCALE;
}

/** A URL veio com prefixo de idioma? Então os links públicos da página mantêm o prefixo. */
export async function hasLocalePrefix(): Promise<boolean> {
  return Boolean(toLocale((await headers()).get(LOCALE_HEADER)));
}
