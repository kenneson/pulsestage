import { getTranslations } from "next-intl/server";

// Páginas públicas (entrada, participante, projetor, feedback): indicador discreto e centralizado.
export default async function Loading() {
  const t = await getTranslations("common.actions");
  return (
    <main className="grid min-h-dvh place-items-center" aria-busy="true">
      <span role="status" className="flex items-center gap-3 text-muted-foreground">
        <span className="size-5 animate-spin rounded-full border-2 border-muted border-t-primary" aria-hidden />
        {t("loading")}
      </span>
    </main>
  );
}
