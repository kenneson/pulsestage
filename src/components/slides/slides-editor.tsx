"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { saveSlidesAction, removeSlidesAction } from "@/features/slides/actions";
import { arrangeInteractionsAction } from "@/features/interactions/actions";
import {
  anchorOf,
  buildDeck,
  dropInteraction,
  placeInteraction,
  slidePath,
  type Arrangement,
  type DeckInteraction,
  type DeckItem,
} from "@/lib/domain/deck";
import type { InteractionType } from "@/lib/domain/interactions";
import { convertPdf, PdfConversionError } from "@/lib/slides/convert-pdf";
import { translateAnyMessage } from "@/i18n/errors";
import { gapText } from "@/i18n/text";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, Progress } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TYPE_PAPER, TypeTag } from "@/components/interaction-type-tag";
import { GripIcon, PresentationIcon, RefreshIcon, TrashIcon } from "@/components/icons";

export type SlideDeckInteraction = DeckInteraction & { type: InteractionType; title: string };

/** Aplica a nova ordem às perguntas (para mostrar o resultado antes de o servidor responder). */
function arranged(interactions: readonly SlideDeckInteraction[], arrangement: Arrangement): SlideDeckInteraction[] {
  const byId = new Map(interactions.map((i) => [i.id, i]));
  return arrangement.ids.flatMap((id, index) => {
    const item = byId.get(id);
    return item ? [{ ...item, afterSlide: arrangement.afterSlides[index] ?? null }] : [];
  });
}

type DropTarget = { index: number; side: "before" | "after" };

const UPLOAD_CONCURRENCY = 4;

type Progressing = { label: string; done: number; total: number };

function useSlidesUpload(sessionId: string, speakerId: string) {
  const t = useTranslations("session.slides");
  const tRoot = useTranslations();
  const router = useRouter();
  const [progress, setProgress] = useState<Progressing | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    try {
      const batch = crypto.randomUUID();
      setProgress({ label: t("converting"), done: 0, total: 1 });
      const { slides, format } = await convertPdf(file, (done, total) =>
        setProgress({ label: t("converting"), done, total }),
      );
      if (slides.length === 0) throw new PdfConversionError("session.slides.errors.noPages");

      const bucket = createClient().storage.from("slides");
      let sent = 0;
      setProgress({ label: t("uploading"), done: 0, total: slides.length });
      const queue = slides.map((blob, index) => ({ blob, index }));
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const { error: uploadError } = await bucket.upload(
            slidePath(speakerId, sessionId, batch, next.index, format),
            next.blob,
            { contentType: next.blob.type, cacheControl: "31536000", upsert: true },
          );
          if (uploadError) throw new PdfConversionError("session.slides.errors.uploadFailed");
          sent += 1;
          setProgress({ label: t("uploading"), done: sent, total: slides.length });
        }
      };
      await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));

      setProgress({ label: t("saving"), done: slides.length, total: slides.length });
      const result = await saveSlidesAction(sessionId, { batch, count: slides.length, format });
      // O erro do servidor já vem traduzido.
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("ready", { count: result.data.count }));
      router.refresh();
    } catch (e) {
      if (!(e instanceof PdfConversionError)) console.error("Falha ao processar o PDF", e);
      setError(
        translateAnyMessage(tRoot, e instanceof PdfConversionError ? e.message : "session.slides.errors.processFailed"),
      );
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
        <span className="font-display text-muted-foreground tabular-nums">
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
  const t = useTranslations("session.slides");
  const tActions = useTranslations("common.actions");
  const tDomain = useTranslations("domain");
  const router = useRouter();
  const { upload, progress, error } = useSlidesUpload(sessionId, speakerId);
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const slideCount = slideUrls.length;
  const busy = progress !== null || pending;
  // A nova ordem aparece na hora; se o servidor recusar, volta ao que estava.
  const [shown, setShown] = useOptimistic(interactions);
  const byId = new Map(shown.map((i) => [i.id, i]));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  function save(arrangement: Arrangement) {
    startTransition(async () => {
      setShown(arranged(shown, arrangement));
      const result = await arrangeInteractionsAction(sessionId, arrangement);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  function place(id: string, afterSlide: number) {
    const arrangement = placeInteraction(shown, id, afterSlide, slideCount);
    if (arrangement) save(arrangement);
  }

  function endDrag() {
    setDragId(null);
    setDropTarget(null);
  }

  /** Solta a pergunta arrastada antes ou depois do item `index` do deck. */
  function drop(deck: DeckItem[], target: DropTarget) {
    const id = dragId;
    endDrag();
    if (!id) return;
    const before = target.side === "before" ? deck[target.index]! : (deck[target.index + 1] ?? null);
    const arrangement = dropInteraction(shown, id, before, slideCount);
    const current = buildDeck(slideCount, shown);
    const next = arrangement ? buildDeck(slideCount, arranged(shown, arrangement)) : current;
    if (arrangement && JSON.stringify(next) !== JSON.stringify(current)) save(arrangement);
  }

  async function remove() {
    const confirmed = await confirm({
      title: t("removeConfirmTitle"),
      description: t("removeConfirmDescription"),
      confirmLabel: tActions("remove"),
      destructive: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await removeSlidesAction(sessionId);
      if (!result.ok) toast.error(result.error);
      else toast.success(t("removed"));
      router.refresh();
    });
  }

  if (slideCount === 0) {
    if (readOnly) {
      return <p className="text-sm text-muted-foreground">{t("noSlidesReadOnly")}</p>;
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
          <p className="font-medium">{t("emptyTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("emptyDescription")}</p>
        </div>
        {progress ? (
          <div className="w-full max-w-sm">
            <UploadProgress progress={progress} />
          </div>
        ) : (
          <PdfPicker onFile={upload} disabled={busy} variant="default">
            {t("choosePdf")}
          </PdfPicker>
        )}
        {error ? <Alert className="max-w-md">{error}</Alert> : null}
        <p className="max-w-lg text-xs text-muted-foreground">{t("exportHelp")}</p>
      </div>
    );
  }

  const deck = buildDeck(slideCount, shown);
  const canDrag = !readOnly && !busy;

  // Alvo de soltura: metade esquerda do item = antes; direita = depois (a grade corre da esquerda para a direita).
  const dropProps = (index: number) =>
    canDrag && dragId
      ? {
          onDragOver: (e: React.DragEvent<HTMLLIElement>) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            const rect = e.currentTarget.getBoundingClientRect();
            const side = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
            if (dropTarget?.index !== index || dropTarget.side !== side) setDropTarget({ index, side });
          },
          onDrop: (e: React.DragEvent<HTMLLIElement>) => {
            e.preventDefault();
            drop(deck, dropTarget?.index === index ? dropTarget : { index, side: "before" });
          },
        }
      : {};
  const marker = (index: number) =>
    dropTarget?.index === index ? (
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 w-1 rounded-full bg-primary",
          dropTarget.side === "before" ? "-left-2" : "-right-2",
        )}
      />
    ) : null;
  const gapOptions = Array.from({ length: slideCount + 1 }, (_, gap) => gap);

  return (
    <div className="flex flex-col gap-4">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t.rich("summary", {
            slides: slideCount,
            questions: shown.length,
            num: (chunks) => <span className="font-display font-bold text-foreground tabular-nums">{chunks}</span>,
          })}{" "}
          {readOnly ? t("readOnlyHint") : t("editHint")}
        </p>
        {!readOnly ? (
          <div className="flex gap-2">
            <PdfPicker onFile={upload} disabled={busy}>
              <RefreshIcon /> {t("replacePdf")}
            </PdfPicker>
            <Button variant="ghost" disabled={busy} onClick={remove}>
              <TrashIcon /> {t("removeSlides")}
            </Button>
          </div>
        ) : null}
      </div>
      {progress ? <UploadProgress progress={progress} /> : null}
      {error ? <Alert>{error}</Alert> : null}

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {deck.map((item, index) => {
          if (item.kind === "slide") {
            return (
              <li key={`s${item.index}`} className="relative flex flex-col gap-1.5" {...dropProps(index)}>
                {marker(index)}
                {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, já em 1920 px */}
                <img
                  src={slideUrls[item.index]}
                  alt={t("slideAlt", { number: item.index + 1 })}
                  loading="lazy"
                  className="aspect-video w-full rounded-lg border bg-muted object-contain"
                />
                <span className="font-display text-xs text-muted-foreground">{t("slideLabel", { number: item.index + 1 })}</span>
              </li>
            );
          }
          const interaction = byId.get(item.id);
          if (!interaction) return null;
          return (
            <li
              key={item.id}
              className={cn(
                "relative flex flex-col gap-2 rounded-lg p-3 text-rev-foreground transition-opacity",
                TYPE_PAPER[interaction.type],
                canDrag && "cursor-grab active:cursor-grabbing",
                dragId === item.id && "opacity-40",
              )}
              draggable={canDrag}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", item.id);
                setDragId(item.id);
              }}
              onDragEnd={endDrag}
              {...dropProps(index)}
            >
              {marker(index)}
              <div className="flex items-start justify-between gap-2">
                <TypeTag type={interaction.type} className="bg-background/60" />
                {canDrag ? <GripIcon aria-hidden className="shrink-0 opacity-60" /> : null}
              </div>
              <p className="line-clamp-3 text-sm font-medium">{interaction.title}</p>
              {readOnly ? (
                <span className="mt-auto text-xs">{gapText(tDomain, interaction.afterSlide, slideCount)}</span>
              ) : (
                <Select
                  aria-label={t("placeAria", { title: interaction.title })}
                  className="mt-auto h-8 text-xs text-foreground"
                  value={anchorOf(interaction.afterSlide, slideCount)}
                  disabled={busy}
                  onChange={(e) => place(interaction.id, Number(e.target.value))}
                >
                  {gapOptions.map((gap) => (
                    <option key={gap} value={gap}>
                      {gap === slideCount ? t("endAfter", { slide: slideCount }) : gapText(tDomain, gap, slideCount)}
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
