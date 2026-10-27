import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OfficeAddin } from "./office-addin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("integrations.office.addin");
  return { title: t("metaTitle"), robots: { index: false } };
}

// Página do suplemento de conteúdo do PowerPoint: o Office carrega esta página dentro do slide
// (manifesto em /office/manifest.xml). Também funciona num navegador comum, para testar.
export default async function OfficePage({ searchParams }: { searchParams: Promise<{ session?: string | string[] }> }) {
  const { session } = await searchParams;
  return <OfficeAddin initialSessionId={typeof session === "string" ? session : null} />;
}
