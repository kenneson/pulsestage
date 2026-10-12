// Envio da imagem de uma alternativa, no navegador do speaker.
// A imagem é reduzida (lado maior com 800 px) e recodificada em WebP antes de subir: leve para a rede
// do evento e sem metadados do arquivo original (como localização da foto).

import { createClient } from "@/lib/supabase/client";
import { OPTION_IMAGE_MAX_BYTES, OPTION_IMAGE_SIZE, OPTION_IMAGES_BUCKET } from "@/lib/domain/gamification";

const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export class OptionImageError extends Error {}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function resize(file: File): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new OptionImageError("Não foi possível abrir a imagem. Use PNG, JPEG ou WebP.");
  }
  const scale = Math.min(1, OPTION_IMAGE_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new OptionImageError("O navegador não conseguiu preparar a imagem.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Safari antigo devolve PNG ao pedir WebP: aí vai JPEG.
  const webp = await toBlob(canvas, "image/webp", 0.82);
  if (webp?.type === "image/webp" && webp.size <= OPTION_IMAGE_MAX_BYTES) return { blob: webp, ext: "webp" };
  const jpeg = await toBlob(canvas, "image/jpeg", 0.82);
  if (!jpeg || jpeg.size > OPTION_IMAGE_MAX_BYTES) throw new OptionImageError("A imagem ficou grande demais.");
  return { blob: jpeg, ext: "jpg" };
}

/** Reduz, envia e devolve o caminho no bucket ({speaker}/{uuid}.webp). */
export async function uploadOptionImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new OptionImageError("Escolha uma imagem.");
  if (file.size > MAX_INPUT_BYTES) throw new OptionImageError("A imagem passa de 15 MB.");

  const { blob, ext } = await resize(file);
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new OptionImageError("Sua sessão expirou. Entre de novo.");

  const path = `${data.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(OPTION_IMAGES_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw new OptionImageError("Falha ao enviar a imagem. Tente de novo.");
  return path;
}
