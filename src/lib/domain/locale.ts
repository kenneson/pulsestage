// Idiomas do PulseStage. Regra pura (sem I/O): lista, normalização, Accept-Language e prefixos de URL.
// Espanhol é um só, latino-americano neutro (es-419: Colômbia, Chile...); inglês é o americano.

export const LOCALES = ["pt-BR", "es-419", "en-US"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt-BR";

/** Nome de cada idioma nele mesmo (o seletor não traduz). */
export const LOCALE_NAME: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
  "es-419": "Español (Latinoamérica)",
  "en-US": "English (US)",
};

export const LOCALE_SHORT: Record<Locale, string> = { "pt-BR": "PT", "es-419": "ES", "en-US": "EN" };

/** Open Graph usa sublinhado. */
export const OG_LOCALE: Record<Locale, string> = { "pt-BR": "pt_BR", "es-419": "es_LA", "en-US": "en_US" };

/** Cookie com a escolha da pessoa (o mesmo nome que o next-intl usa). */
export const LOCALE_COOKIE = "NEXT_LOCALE";
/** Cabeçalho que o proxy grava quando a URL tem prefixo de idioma (/es, /en). */
export const LOCALE_HEADER = "x-pulsestage-locale";

/** Prefixo de URL das páginas públicas. Português fica na raiz. */
export const LOCALE_PREFIX: Record<Locale, string> = { "pt-BR": "", "es-419": "/es", "en-US": "/en" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** "es", "es-CO", "es_CL" → es-419; "en", "en-GB" → en-US; "pt", "pt-PT" → pt-BR. Desconhecido → null. */
export function toLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const tag = value.trim().replace("_", "-").toLowerCase();
  if (isLocale(value)) return value;
  const lang = tag.split("-")[0];
  if (lang === "pt") return "pt-BR";
  if (lang === "es") return "es-419";
  if (lang === "en") return "en-US";
  return null;
}

/** Idioma vindo do banco (sessão, perfil): valor desconhecido vira português. */
export function localeOrDefault(value: string | null | undefined): Locale {
  return toLocale(value) ?? DEFAULT_LOCALE;
}

/** Primeiro idioma suportado do Accept-Language, respeitando os pesos (q). */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((e) => e.tag && e.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const entry of ranked) {
    const locale = toLocale(entry.tag);
    if (locale) return locale;
  }
  return null;
}

/** Separa o prefixo de idioma: "/es/palestrantes" → { locale: "es-419", path: "/palestrantes" }. */
export function splitLocalePrefix(pathname: string): { locale: Locale | null; path: string } {
  for (const locale of LOCALES) {
    const prefix = LOCALE_PREFIX[locale];
    if (!prefix) continue;
    if (pathname === prefix) return { locale, path: "/" };
    if (pathname.startsWith(`${prefix}/`)) return { locale, path: pathname.slice(prefix.length) };
  }
  return { locale: null, path: pathname };
}

/** Caminho público no idioma: localizedPath("es-419", "/palestrantes") → "/es/palestrantes". */
export function localizedPath(locale: Locale, path: string): string {
  const prefix = LOCALE_PREFIX[locale];
  if (!prefix) return path;
  return path === "/" ? prefix : `${prefix}${path}`;
}

/** Páginas que aceitam prefixo de idioma (as que o Google indexa e as de entrada). */
const PUBLIC_PATHS = ["/", "/palestrantes", "/p", "/privacidade", "/login", "/signup", "/join"];

export function isLocalizablePath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`)));
}

/** Nome do idioma para instruções à IA ("Responda em ..."). */
export const LOCALE_AI_NAME: Record<Locale, string> = {
  "pt-BR": "português do Brasil",
  "es-419": "espanhol latino-americano neutro (tratamento por “tú”, sem gírias regionais)",
  "en-US": "inglês americano",
};
