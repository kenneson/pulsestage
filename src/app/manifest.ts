import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";

// Instalar como app (PWA leve, sem service worker): abre direto no painel, em janela própria.
// Cores = fundo claro do tema (o mesmo `themeColor` claro do layout).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [locale, tMeta, tNav] = await Promise.all([getLocale(), getTranslations("common.meta"), getTranslations("dashboard.nav")]);
  return {
    id: "/dashboard",
    name: "PulseStage",
    short_name: "PulseStage",
    description: tMeta("description"),
    lang: locale,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#f7f9fc",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: tNav("newSession"), url: "/dashboard/sessions/new" },
      { name: tNav("sessions"), url: "/dashboard/sessions" },
    ],
  };
}
