"use client";

import { cn } from "@/lib/utils";
import { useBrand } from "./brand-context";

/**
 * Logo do palestrante, pequeno: cabeçalho do celular (`size="sm"`, 28 px de altura) ou rodapé do telão
 * (`size="md"`, 40 px). Sem marca na sessão, não renderiza nada: pode ficar no lugar sempre.
 */
export function BrandMark({ size = "sm", className }: { size?: "sm" | "md"; className?: string }) {
  const brand = useBrand();
  if (!brand?.logoUrl) return null;
  return (
    // Logo de terceiros, em proporção livre: <img> simples, sem otimização do Next (já vem reduzido a 400 px).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.logoUrl}
      alt={brand.logoAlt}
      decoding="async"
      className={cn("w-auto shrink-0 object-contain", size === "sm" ? "h-7 max-w-28" : "h-10 max-w-48", className)}
    />
  );
}
