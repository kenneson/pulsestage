import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPublicProfiles } from "@/lib/data/speaker-profile";
import { inDirectory, topTopics } from "@/lib/domain/speaker-profile";
import { LOCALES, localizedPath } from "@/lib/domain/locale";

// Recalculado a cada hora: perfis e temas novos entram sem novo deploy.
export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.appUrl;
  // Uma entrada por idioma (/, /es, /en), cada uma apontando as outras (hreflang).
  const pages: MetadataRoute.Sitemap = [];
  const add = (path: string, changeFrequency: Entry["changeFrequency"], priority: number) => {
    const languages = Object.fromEntries(LOCALES.map((l) => [l, `${base}${localizedPath(l, path)}`]));
    for (const locale of LOCALES) {
      pages.push({ url: `${base}${localizedPath(locale, path)}`, changeFrequency, priority, alternates: { languages } });
    }
  };
  add("/", "weekly", 1);
  add("/palestrantes", "daily", 0.8);
  add("/privacidade", "yearly", 0.2);
  try {
    const entries = await listPublicProfiles(createAdminClient());
    for (const e of entries) {
      if (inDirectory(e.stats)) add(`/p/${e.slug}`, "weekly", 0.6);
    }
    for (const t of topTopics(entries, 500)) add(`/palestrantes/tema/${t.key}`, "weekly", 0.5);
  } catch {
    // Sem banco (ex.: build sem variáveis), o sitemap sai só com as páginas fixas.
  }
  return pages;
}
