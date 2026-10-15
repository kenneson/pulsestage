import "server-only";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LOCALES, localizedPath, OG_LOCALE } from "@/lib/domain/locale";
import { hasLocalePrefix } from "./locale.server";

/**
 * Canonical e hreflang de uma página pública (landing, palestrantes, perfil, privacidade): uma URL por idioma
 * (/, /es, /en). Caminhos relativos: o metadataBase do layout completa o domínio.
 */
export async function localeAlternates(path: string): Promise<NonNullable<Metadata["alternates"]>> {
  const locale = await getLocale();
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((l) => [l, localizedPath(l, path)]));
  languages["x-default"] = path;
  return { canonical: localizedPath(locale, path), languages };
}

/** og:locale da página. */
export async function ogLocale(): Promise<string> {
  return OG_LOCALE[await getLocale()];
}

/**
 * Link interno de página pública mantendo o idioma da URL: quem chegou por /es/... (ou o Google) continua em
 * /es/...; quem navega sem prefixo (cookie) continua sem prefixo.
 */
export async function getPublicHref(): Promise<(path: string) => string> {
  const [locale, prefixed] = await Promise.all([getLocale(), hasLocalePrefix()]);
  return (path: string) => (prefixed ? localizedPath(locale, path) : path);
}
