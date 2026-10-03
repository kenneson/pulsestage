"use client";

import { Button } from "@/components/ui/button";
import { FileTextIcon } from "@/components/icons";

/** Abre a impressão do navegador: "Salvar como PDF" gera o arquivo. */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <FileTextIcon /> Salvar PDF
    </Button>
  );
}
