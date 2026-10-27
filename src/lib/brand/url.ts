import { publicEnv } from "@/lib/env";
import { brandLogoUrl } from "@/lib/domain/brand";

/** URL pública do logo do palestrante (servidor ou navegador). */
export function brandLogoSrc(path: string): string {
  return brandLogoUrl(publicEnv.supabaseUrl, path);
}
