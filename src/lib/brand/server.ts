import "server-only";
import { cache } from "react";
import { createAdminClient, type AdminSupabase } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { BRAND_BUCKET, brandPalette, sessionBrand, type BrandPalette } from "@/lib/domain/brand";
import { isUuid } from "@/lib/action-result";
import { localeOrDefault, type Locale } from "@/lib/domain/locale";
import { brandLogoSrc } from "./url";

// Marca do palestrante na área da sessão (celular e telão). Lida com a secret key: a plateia não tem
// login e `profiles` não é público. Sai daqui só o que já é público na tela: a URL do logo e as cores.

/** `locale`: idioma da sessão (o do texto alternativo do logo). */
export type SessionBrand = { logoUrl: string | null; palette: BrandPalette | null; locale: Locale };

/** Marca da sessão (null sem `use_brand` ou sem logo e cor no perfil). Uma leitura por requisição. */
export const getSessionBrand = cache(async (sessionId: string): Promise<SessionBrand | null> => {
  if (!isUuid(sessionId)) return null;
  const admin = createAdminClient();
  const { data: session } = await admin.from("sessions").select("use_brand, speaker_id, locale").eq("id", sessionId).maybeSingle();
  if (!session?.use_brand) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("brand_logo_path, brand_color")
    .eq("id", session.speaker_id)
    .maybeSingle();
  const brand = sessionBrand(session.use_brand, profile);
  if (!brand) return null;
  return {
    logoUrl: brand.logoPath ? brandLogoSrc(brand.logoPath) : null,
    palette: brand.color ? brandPalette(brand.color) : null,
    locale: localeOrDefault(session.locale),
  };
});

/** Apaga os logos da pasta do speaker, menos `keep` (troca de logo, remoção e exclusão de conta). */
export async function removeBrandLogos(client: ServerSupabase | AdminSupabase, speakerId: string, keep?: string): Promise<void> {
  const bucket = client.storage.from(BRAND_BUCKET);
  const { data, error } = await bucket.list(speakerId, { limit: 100 });
  if (error || !data) return;
  const old = data.map((f) => `${speakerId}/${f.name}`).filter((path) => path !== keep);
  if (old.length > 0) await bucket.remove(old);
}
