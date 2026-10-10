"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { saveSlidesAction, removeSlidesAction } from "@/features/slides/actions";
import { arrangeInteractionsAction } from "@/features/interactions/actions";
import { anchorOf, buildDeck, gapLabel, placeInteraction, slidePath, type DeckInteraction } from "@/lib/domain/deck";
import type { InteractionType } from "@/lib/domain/interactions";
import { convertPdf, PdfConversionError } from "@/lib/slides/convert-pdf";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, Progress } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TYPE_PAPER, TypeTag } from "@/components/interaction-type-tag";
import { PresentationIcon, RefreshIcon, TrashIcon } from "@/components/icons";

export type SlideDeckInteraction = DeckInteraction & { type: InteractionType; title: string };

const UPLOAD_CONCURRENCY = 4;

type Progressing = { label: string; done: number; total: number };

function useSlidesUpload(sessionId: string, speakerId: string) {
  const router = useRouter();
  const [progress, setProgress] = useState<Progressing | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    try {
      const batch = crypto.randomUUID();
      setProgress({ label: "Convertendo o PDF", done: 0, total: 1 });
      const { slides, format } = await convertPdf(file, (done, total) =>
        setProgress({ label: "Convertendo o PDF", done, total }),
      );
      if (slides.length === 0) throw new PdfConversionError("O PDF não tem páginas.");

      const bucket = createClient().storage.from("slides");
      let sent = 0;
      setProgress({ label: "Enviando os slides", done: 0, total: slides.length });
      const queue = slides.map((blob, index) => ({ blob, index }));
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const { error: uploadError } = await bucket.upload(
            slidePath(speakerId, sessionId, batch, next.index, format),
            next.blob,
            { contentType: next.blob.type, cacheControl: "31536000", upsert: true },
          );
          if (uploadError) throw new PdfConversionError("Falha ao enviar os slides. Verifique a conexão e tente de novo.");
          sent += 1;
          setProgress({ label: "Enviando os slides", done: sent, total: slides.length });
        }
      };
      await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));

      setProgress({ label: "Salvando", done: slides.length, total: slides.length });
      const result = await saveSlidesAction(sessionId, { batch, count: slides.length, format });
      if (!result.ok) throw new PdfConversionError(result.error);
      toast.success(`${result.data.count} slides prontos.`);
      router.refresh();
    } catch (e) {
      if (!(e instanceof PdfConversionError)) console.error("Falha ao processar o PDF", e);
      setError(e instanceof PdfConversionError ? e.message : "Não foi possível processar o PDF.");
    } finally {
      setProgress(null);
    }
  }

  return { upload, progress, error };
}

function PdfPicker({
  onFile,
  disabled,
  children,
  variant = "outline",
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "outline" | "default";
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button variant={variant} disabled={disabled} onClick={() => input.current?.click()}>
        {children}
      </Button>
    </>
  );
}

function UploadProgress({ progress }: { progress: Progressing }) {
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <p className="text-sm font-medium">
        {progress.label}…{" "}
        <span className="font-script text-muted-foreground tabular-nums">
          {progress.done}/{progress.total}
        </span>
      </p>
      <Progress value={(progress.done / Math.max(1, progress.total)) * 100} />
    </div>
  );
}

export function SlidesEditor({
  sessionId,
  speakerId,
  slideUrls,
  interactions,
  readOnly,
}: {
  sessionId: string;
  speakerId: string;
  slideUrls: string[];
  /** na ordem do roteiro */
  interactions: SlideDeckInteraction[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const { upload, progress, error } = useSlidesUpload(sessionId, speakerId);
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const slideCount = slideUrls.length;
  const busy = progress !== null || pending;
  const byId = new Map(interactions.map((i) => [i.id, i]));

  function place(id: string, afterSlide: number) {
    const arrangement = placeInteraction(interactions, id, afterSlide, slideCount);
    if (!arrangement) return;
    startTransition(async () => {
      const result = await arrangeInteractionsAction(sessionId, arrangement);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  async function remove() {
    const confirmed = await confirm({
      title: "Remover os slides?",
      description: "As perguntas continuam no roteiro. Se você enviar outro PDF, elas voltam para os mesmos pontos.",
      confirmLabel: "Remover",
      destructive: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await removeSlidesAction(sessionId);
      if (!result.ok) toast.error(result.error);
      else toast.success("Slides removidos.");
      router.refresh();
    });
  }

  if (slideCount === 0) {
    if (readOnly) {
      return <p className="text-sm text-muted-foreground">Esta sessão foi apresentada sem slides.</p>;
    }
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
          dragging && "border-primary bg-primary/5",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && !busy) void upload(file);
        }}
      >
        <span className="grid size-12 place-items-center rounded-xl bg-muted [&_svg]:size-6">
          <PresentationIcon />
        </span>
        <div className="flex max-w-md flex-col gap-1">
          <p className="font-medium">Apresente seus slides daqui, sem trocar de janela</p>
          <p className="text-sm text-muted-foreground">
            Envie o PDF da apresentação. As perguntas entram entre os slides e o passador avança tudo: slide, pergunta,
            resultado, próximo slide.
          </p>
        </div>
        {progress ? (
          <div className="w-full max-w-sm">
            <UploadProgress progress={progress} />
          </div>
        ) : (
          <PdfPicker onFile={upload} disabled={busy} variant="default">
            Escolher PDF
          </PdfPicker>
        )}
        {error ? <Alert className="max-w-md">{error}</Alert> : null}
        <p className="max-w-lg text-xs text-muted-foreground">
          PowerPoint: Arquivo → Exportar → PDF · Google Slides: Arquivo → Fazer download → PDF · Keynote: Arquivo →
          Exportar para → PDF · Canva: Compartilhar → Baixar → PDF. O PDF é convertido no seu navegador; só as imagens
          dos slides são enviadas. Animações e vídeos não são mantidos.
        </p>
      </div>
    );
  }

  const deck = buildDeck(slideCount, interactions);
  const gapOptions = Array.from({ length: slideCount + 1 }, (_, gap) => gap);

  return (
    <div className="flex flex-col gap-4">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-script font-bold text-foreground tabular-nums">{slideCount}</span> slides ·{" "}
          {interactions.length} perguntas. Escolha em que ponto da apresentação cada pergunta entra.
        </p>
        {!readOnly ? (
          <div className="flex gap-2">
            <PdfPicker onFile={upload} disabled={busy}>
              <RefreshIcon /> Trocar PDF
            </PdfPicker>
            <Button variant="ghost" disabled={busy} onClick={remove}>
              <TrashIcon /> Remover slides
            </Button>
          </div>
        ) : null}
      </div>
      {progress ? <UploadProgress progress={progress} /> : null}
      {error ? <Alert>{error}</Alert> : null}

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {deck.map((item) => {
          if (item.kind === "slide") {
            return (
              <li key={`s${item.index}`} className="flex flex-col gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, já em 1920 px */}
                <img
                  src={slideUrls[item.index]}
                  alt={`Slide ${item.index + 1}`}
                  loading="lazy"
                  className="aspect-video w-full rounded-lg border bg-muted object-contain"
                />
                <span className="font-script text-xs text-muted-foreground">Slide {item.index + 1}</span>
              </li>
            );
          }
          const interaction = byId.get(item.id);
          if (!interaction) return null;
          return (
            <li
              key={item.id}
              className={cn("flex flex-col gap-2 rounded-lg p-3 text-rev-foreground", TYPE_PAPER[interaction.type])}
            >
              <TypeTag type={interaction.type} className="bg-background/60" />
              <p className="line-clamp-3 text-sm font-medium">{interaction.title}</p>
              {readOnly ? (
                <span className="mt-auto text-xs">{gapLabel(interaction.afterSlide, slideCount)}</span>
              ) : (
                <Select
                  aria-label={`Ponto da apresentação de "${interaction.title}"`}
                  className="mt-auto h-8 text-xs text-foreground"
                  value={anchorOf(interaction.afterSlide, slideCount)}
                  disabled={busy}
                  onChange={(e) => place(interaction.id, Number(e.target.value))}
                >
                  {gapOptions.map((gap) => (
                    <option key={gap} value={gap}>
                      {gap === slideCount ? `No fim (depois do slide ${slideCount})` : gapLabel(gap, slideCount)}
                    </option>
                  ))}
                </Select>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
