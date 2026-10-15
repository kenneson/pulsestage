"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">{t("errorPage.title")}</h1>
      <p className="text-muted-foreground">{t("errorPage.description")}</p>
      <Button onClick={reset}>{t("actions.retry")}</Button>
    </main>
  );
}
