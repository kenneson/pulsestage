"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FileTextIcon } from "@/components/icons";

/** Abre a impressão do navegador: "Salvar como PDF" gera o arquivo. */
export function PrintButton() {
  const t = useTranslations("analytics.print");
  return (
    <Button onClick={() => window.print()} className="max-md:h-11">
      <FileTextIcon /> {t("button")}
    </Button>
  );
}
