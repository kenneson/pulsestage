import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPublicProfiles } from "@/lib/data/speaker-profile";
import { inDirectory, topTopics } from "@/lib/domain/speaker-profile";

// Recalculado a cada hora: perfis e temas novos entram sem novo deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.appUrl;
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/palestrantes`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/privacidade`, changeFrequency: "yearly", priority: 0.2 },
  ];
  try {
    const entries = await listPublicProfiles(createAdminClient());
    for (const e of entries) {
      if (inDirectory(e.stats)) pages.push({ url: `${base}/p/${e.slug}`, changeFrequency: "weekly", priority: 0.6 });
    }
    for (const t of topTopics(entries, 500)) {
      pages.push({ url: `${base}/palestrantes/tema/${t.key}`, changeFrequency: "weekly", priority: 0.5 });
    }
  } catch {
    // Sem banco (ex.: build sem variáveis), o sitemap sai só com as páginas fixas.
  }
  return pages;
}
