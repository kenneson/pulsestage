"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { reorderSlidesAction } from "@/features/slides/actions";
import { identityOrder, isIdentityOrder, moveInOrder } from "@/lib/domain/slide-order";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "@/components/icons";

/**
 * Nova ordem dos slides: arrastar (computador), tocar num slide e depois no destino (celular) ou setas
 * (teclado). Nada é gravado até "Salvar ordem". Folha no celular, diálogo largo no computador.
 */
export function ReorderSlidesDialog({
  sessionId,
  slideUrls,
  onClose,
  onSaved,
}: {
  sessionId: string;
  slideUrls: string[];
  onClose: () => void;
  /** nova ordem salva (order[i] = número original do slide na posição i + 1) */
  onSaved: (order: number[]) => void;
}) {
  const t = useTranslations("session.slides.reorder");
  const tSlides = useTranslations("session.slides");
  const tActions = useTranslations("common.actions");
  const ref = useRef<HTMLDialogElement>(null);
  // order[i] = número original (a partir de 1) do slide na posição i + 1.
  const [order, setOrder] = useState(() => identityOrder(slideUrls.length));
  const [picked, setPicked] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = !isIdentityOrder(order);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function move(from: number, to: number) {
    setOrder((current) => moveInOrder(current, from, to));
    setPicked(null);
  }

  function tap(position: number) {
    if (picked === null) setPicked(position);
    else if (picked === position) setPicked(null);
    else move(picked, position);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await reorderSlidesAction(sessionId, order);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("saved"));
      onSaved(order);
      ref.current?.close();
    });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="reorder-slides-title"
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-xl border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50 max-md:mb-0 max-md:max-h-[calc(100dvh-1.5rem)] max-md:w-full max-md:max-w-none max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0"
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-start justify-between gap-3 border-b p-6 max-md:p-4">
          <div className="flex flex-col gap-1">
            <h2 id="reorder-slides-title" className="text-lg font-semibold">
              {t("title")}
            </h2>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {picked !== null ? t("selected", { number: order[picked]! }) : t("description")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="max-md:-mr-2 max-md:shrink-0"
            aria-label={tActions("close")}
            onClick={() => ref.current?.close()}
          >
            <XIcon />
          </Button>
        </div>

        <ol className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto overscroll-contain p-6 sm:grid-cols-3 lg:grid-cols-4 max-md:p-4">
          {order.map((slide, position) => {
            const isPicked = picked === position;
            const canDropHere = picked !== null && !isPicked;
            return (
              <li
                key={slide}
                draggable={!pending}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(position));
                  setDragFrom(position);
                  setPicked(null);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setOver(null);
                }}
                onDragOver={(e) => {
                  if (dragFrom === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (over !== position) setOver(position);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom !== null) move(dragFrom, position);
                  setDragFrom(null);
                  setOver(null);
                }}
                className={cn(
                  "flex cursor-grab flex-col gap-1.5 rounded-lg p-1.5 transition-colors active:cursor-grabbing",
                  dragFrom === position && "opacity-40",
                  isPicked && "bg-primary/10 ring-2 ring-primary",
                  dragFrom !== null && over === position && dragFrom !== position && "ring-2 ring-primary/60",
                )}
              >
                <button
                  type="button"
                  disabled={pending}
                  aria-pressed={isPicked}
                  aria-label={canDropHere ? t("dropHere", { number: position + 1 }) : t("pick", { number: position + 1 })}
                  onClick={() => tap(position)}
                  className={cn(
                    "block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    canDropHere && "hover:ring-2 hover:ring-primary/60",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage */}
                  <img
                    src={slideUrls[slide - 1]}
                    alt={tSlides("slideAlt", { number: slide })}
                    draggable={false}
                    loading="lazy"
                    className="aspect-video w-full rounded-lg border bg-muted object-contain"
                  />
                </button>
                <div className="flex min-h-8 items-center justify-between gap-1 max-md:min-h-11">
                  <span className="font-display text-xs text-muted-foreground tabular-nums">
                    {t("position", { number: position + 1 })}
                    {slide !== position + 1 ? <span className="ml-1 opacity-70">({t("was", { number: slide })})</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 max-md:size-11"
                      disabled={pending || position === 0}
                      aria-label={t("moveEarlier", { number: position + 1 })}
                      onClick={() => move(position, position - 1)}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 max-md:size-11"
                      disabled={pending || position === order.length - 1}
                      aria-label={t("moveLater", { number: position + 1 })}
                      onClick={() => move(position, position + 1)}
                    >
                      <ChevronRightIcon />
                    </Button>
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-3 border-t p-6 max-md:p-4 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {error ? <Alert>{error}</Alert> : null}
          <div className="flex flex-wrap items-center gap-2 max-md:grid max-md:grid-cols-2">
            <Button onClick={save} disabled={pending || !changed}>
              {pending ? t("saving") : t("save")}
            </Button>
            <Button variant="ghost" onClick={() => ref.current?.close()} disabled={pending}>
              {tActions("cancel")}
            </Button>
            <Button
              variant="ghost"
              className="md:ml-auto max-md:col-span-2"
              disabled={pending || !changed}
              onClick={() => {
                setOrder(identityOrder(slideUrls.length));
                setPicked(null);
              }}
            >
              {t("reset")}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
