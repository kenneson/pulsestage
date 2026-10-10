// Converte o PDF da apresentação em imagens, no navegador do speaker.
// O PDF nunca é enviado: só as imagens dos slides vão para o Storage.
// Módulo só de cliente; o pdf.js é carregado sob demanda para não pesar no resto do painel.

import { MAX_SLIDES, SLIDE_RENDER_WIDTH, type SlideFormat } from "@/lib/domain/deck";

export const MAX_PDF_BYTES = 80 * 1024 * 1024;

export class PdfConversionError extends Error {}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** WebP quando o navegador codifica; senão JPEG (Safari antigo devolve PNG ao pedir WebP). */
async function encode(canvas: HTMLCanvasElement, preferred: SlideFormat): Promise<{ blob: Blob; format: SlideFormat }> {
  if (preferred === "webp") {
    const webp = await toBlob(canvas, "image/webp", 0.85);
    if (webp?.type === "image/webp") return { blob: webp, format: "webp" };
  }
  const jpeg = await toBlob(canvas, "image/jpeg", 0.88);
  if (!jpeg) throw new PdfConversionError("O navegador não conseguiu gerar as imagens dos slides.");
  return { blob: jpeg, format: "jpeg" };
}

export async function convertPdf(
  file: File,
  onProgress: (done: number, total: number) => void,
): Promise<{ slides: Blob[]; format: SlideFormat }> {
  if (file.type && file.type !== "application/pdf") throw new PdfConversionError("Escolha um arquivo PDF.");
  if (file.size > MAX_PDF_BYTES) throw new PdfConversionError("O PDF passa de 80 MB. Exporte com imagens comprimidas.");

  // Build "legacy": inclui polyfills para Safari e Chrome mais antigos, comuns em notebooks de palco.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), {
    type: "module",
  });

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch {
    void task.destroy();
    throw new PdfConversionError("Não foi possível abrir o PDF. Ele pode estar protegido por senha ou corrompido.");
  }

  try {
    const total = doc.numPages;
    if (total > MAX_SLIDES) throw new PdfConversionError(`O PDF tem ${total} páginas; o limite é ${MAX_SLIDES}.`);

    const canvas = document.createElement("canvas");
    const slides: Blob[] = [];
    let format: SlideFormat = "webp";
    onProgress(0, total);

    for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      // O lado maior vira 1920 px: nítido no projetor e leve para a rede do evento.
      const viewport = page.getViewport({ scale: SLIDE_RENDER_WIDTH / Math.max(base.width, base.height) });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      page.cleanup();

      // O formato do primeiro slide vale para todos (o caminho no Storage depende dele).
      const encoded = await encode(canvas, format);
      if (pageNumber > 1 && encoded.format !== format) {
        throw new PdfConversionError("O navegador não conseguiu gerar as imagens dos slides.");
      }
      format = encoded.format;
      slides.push(encoded.blob);
      onProgress(pageNumber, total);
    }
    return { slides, format };
  } finally {
    void task.destroy();
  }
}
