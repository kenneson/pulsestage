"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { copyToSessionAction } from "@/features/library/actions";
import type { LibraryItem } from "@/lib/domain/library";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { LibraryFilters, LibraryItemSummary, useLibraryFilter } from "@/components/library/library-picker";
import { PlusIcon, XIcon } from "@/components/icons";

type OpenSession = { id: string; title: string };

export function LibraryTable({ items, sessions }: { items: LibraryItem[]; sessions: OpenSession[] }) {
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
      const name = sessions.find((s) => s.id === target)?.title ?? "a sessão";
      toast.success(`Pergunta adicionada a “${name}”.`);
      dialogRef.current?.close();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <LibraryFilters {...filter} />

      {filter.filtered.length === 0 ? (
        <EmptyState title="Nenhuma pergunta encontrada" description="Ajuste a busca ou o filtro de tipo." />
      ) : (
        <ul className="divide-y rounded-md bg-card shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border">
          {filter.filtered.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-[1_1_320px]">
                <LibraryItemSummary item={item} />
              </div>
              <Button variant="outline" size="sm" onClick={() => open(item)} disabled={sessions.length === 0}>
                <PlusIcon /> Usar em uma sessão
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
              Usar em uma sessão
            </h2>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => dialogRef.current?.close()}
              className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <XIcon />
            </button>
          </div>
          {choice ? <p className="text-sm">“{choice.title}”</p> : null}
          <label className="flex flex-col gap-2 text-sm font-medium">
            Sessão de destino
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
            <span className="text-xs font-normal text-muted-foreground">A pergunta entra no fim do roteiro.</span>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => dialogRef.current?.close()}>
              Cancelar
            </Button>
            <Button onClick={confirm} disabled={pending || !target}>
              {pending ? "Adicionando…" : "Adicionar"}
            </Button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma sessão aberta. <Link href="/dashboard/sessions/new" className="text-primary hover:underline">Crie uma sessão</Link>.
            </p>
          ) : null}
        </div>
      </dialog>
    </div>
  );
}
