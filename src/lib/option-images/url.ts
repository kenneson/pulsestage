import { publicEnv } from "@/lib/env";
import { optionImageUrl } from "@/lib/domain/gamification";

/** URL pública da imagem de uma alternativa (servidor ou navegador). */
export function optionImageSrc(path: string): string {
  return optionImageUrl(publicEnv.supabaseUrl, path);
}
