// Envio do logo do palestrante, no navegador. O logo é reduzido (lado maior com até 400 px) e
// recodificado em WebP (PNG no Safari antigo), sem metadados do arquivo original, e sobe direto para o
// bucket público `brand`, na pasta do próprio speaker (o RLS do Storage só deixa gravar nela).
// Transparência é mantida: os dois formatos têm canal alfa.

import { createClient } from "@/lib/supabase/client";
import { BRAND_BUCKET, BRAND_LOGO_MAX_BYTES, BRAND_LOGO_SIZE } from "@/lib/domain/brand";
import { messageKey } from "@/lib/domain/message-key";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

// Mensagens são chaves completas ("account.brand.errors.*"): o formulário traduz.
export class BrandLogoError extends Error {}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function resize(file: File): Promise<{ blob: Blob; ext: "webp" | "png" }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new BrandLogoError("account.brand.errors.cannotOpen");
  }
  const scale = Math.min(1, BRAND_LOGO_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new BrandLogoError("account.brand.errors.cannotOpen");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.9, 0.75]) {
    const webp = await toBlob(canvas, "image/webp", quality);
    if (webp?.type === "image/webp" && webp.size <= BRAND_LOGO_MAX_BYTES) return { blob: webp, ext: "webp" };
  }
  const png = await toBlob(canvas, "image/png");
  if (!png || png.size > BRAND_LOGO_MAX_BYTES) {
    throw new BrandLogoError(messageKey("account.brand.errors.tooLargeResult", { max: BRAND_LOGO_MAX_BYTES / 1024 }));
  }
  return { blob: png, ext: "png" };
}

/** Reduz, envia e devolve o caminho no bucket ({speaker}/logo-{uuid}.webp). */
export async function uploadBrandLogo(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") throw new BrandLogoError("account.brand.errors.notImage");
  if (file.size > MAX_INPUT_BYTES) {
    throw new BrandLogoError(messageKey("account.brand.errors.tooLarge", { max: MAX_INPUT_BYTES / (1024 * 1024) }));
  }
  const { blob, ext } = await resize(file);
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new BrandLogoError("account.brand.errors.sessionExpired");

  const path = `${data.user.id}/logo-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BRAND_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw new BrandLogoError("account.brand.errors.uploadFailed");
  return path;
}
