"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { copyToSessionAction } from "@/features/library/actions";
import type { LibraryItem } from "@/lib/domain/library";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { LibraryFilters, LibraryItemSummary, useLibraryFilter } from "@/components/library/library-picker";
import { PlusIcon, XIcon } from "@/components/icons";

type OpenSession = { id: string; title: string };

export function LibraryTable({ items, sessions }: { items: LibraryItem[]; sessions: OpenSession[] }) {
  const t = useTranslations("dashboard.libraryTable");
  const tActions = useTranslations("common.actions");
  const filter = useLibraryFilter(items);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState<LibraryItem | null>(null);
  const [target, setTarget] = useState(sessions[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function open(item: LibraryItem) {
    setChoice(item);
    dialogRef.current?.showModal();
  }

  function confirm() {
    if (!choice || !target) return;
    startTransition(async () => {
      const result = await copyToSessionAction({ targetSessionId: target, interactionIds: [choice.sourceId] });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const name = sessions.find((s) => s.id === target)?.title;
      toast.success(name ? t("added", { name }) : t("addedGeneric"));
      dialogRef.current?.close();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <LibraryFilters {...filter} />

      {filter.filtered.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <ul className="divide-y rounded-md bg-card shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border">
          {filter.filtered.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center gap-4 px-5 py-4 max-md:gap-3 max-md:px-4">
              <div className="min-w-0 flex-[1_1_320px]">
                <LibraryItemSummary item={item} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="max-md:h-11 max-md:text-sm"
                onClick={() => open(item)}
                disabled={sessions.length === 0}
              >
                <PlusIcon /> {t("useInSession")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="use-in-session-title"
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <h2 id="use-in-session-title" className="text-lg font-semibold">
              {t("useInSession")}
            </h2>
            <button
              type="button"
              aria-label={tActions("close")}
              onClick={() => dialogRef.current?.close()}
              className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted max-md:-mt-1.5 max-md:-mr-2 max-md:size-11"
            >
              <XIcon />
            </button>
          </div>
          {choice ? <p className="text-sm">“{choice.title}”</p> : null}
          <label className="flex flex-col gap-2 text-sm font-medium">
            {t("targetSession")}
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
            <span className="text-xs font-normal text-muted-foreground">{t("entersAtEnd")}</span>
          </label>
          <div className="flex flex-wrap justify-end gap-2 max-md:grid max-md:grid-cols-2 max-md:[&>button]:h-11">
            <Button variant="outline" onClick={() => dialogRef.current?.close()}>
              {tActions("cancel")}
            </Button>
            <Button onClick={confirm} disabled={pending || !target}>
              {pending ? t("adding") : tActions("add")}
            </Button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.rich("noOpenSessions", {
                link: (chunks) => (
                  <Link href="/dashboard/sessions/new" className="text-primary hover:underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
