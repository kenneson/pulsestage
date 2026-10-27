"use client";

import { createContext, useContext } from "react";

/** Logo do palestrante na área da sessão (null = sem logo ou sem marca). */
export type BrandValue = { logoUrl: string | null; logoAlt: string };

const BrandContext = createContext<BrandValue | null>(null);

export function BrandProvider({ value, children }: { value: BrandValue; children: React.ReactNode }) {
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

/** Marca da sessão atual; null fora da área da sessão ou quando a sessão não usa marca. */
export function useBrand(): BrandValue | null {
  return useContext(BrandContext);
}
