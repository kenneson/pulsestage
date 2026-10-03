"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { copyToSessionAction } from "@/features/library/actions";
import { INTERACTION_TYPE_META, INTERACTION_TYPES, isInteractionType } from "@/lib/domain/interactions";
import { matchesLibraryQuery, type LibraryItem } from "@/lib/domain/library";
import { formatPercent, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TYPE_PAPER, TypeTag } from "@/components/interaction-type-tag";
import { LibraryIcon, SearchIcon, XIcon } from "@/components/icons";

/** Busca + filtro por tipo, compartilhados pela janela de escolha e pela página da biblioteca. */
export function useLibraryFilter(items: LibraryItem[]) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string | null>(null);
  const filtered = useMemo(
    () => items.filter((i) => (type === null || i.type === type) && matchesLibraryQuery(i, query)),
    [items, query, type],
  );
  return { query, setQuery, type, setType, filtered };
}

export function LibraryFilters({
  query,
  setQuery,
  type,
  setType,
}: Pick<ReturnType<typeof useLibraryFilter>, "query" | "setQuery" | "type" | "setType">) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-h-11 flex-[1_1_260px] items-center gap-2 rounded-md border bg-background px-3 text-muted-foreground focus-within:ring-2 focus-within:ring-ring/40">
        <SearchIcon />
        <span className="sr-only">Buscar perguntas</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar perguntas"
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none md:text-sm"
        />
      </label>
      <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={type === null}
          onClick={() => setType(null)}
          className={cn(
            "min-h-9 rounded-full border px-3 text-sm font-medium",
            type === null ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
          )}
        >
          Todas
        </button>
        {INTERACTION_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => setType(type === t ? null : t)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium",
              type === t ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            <span aria-hidden className={cn("size-2.5 rounded-sm", TYPE_PAPER[t])} />
            {INTERACTION_TYPE_META[t].label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LibraryItemSummary({ item }: { item: LibraryItem }) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      {isInteractionType(item.type) ? <TypeTag type={item.type} /> : null}
      <span className="font-medium">{item.title}</span>
      {item.optionLabels.length > 0 ? (
        <span className="truncate text-sm text-muted-foreground">{item.optionLabels.join(" · ")}</span>
      ) : null}
      <span className="text-xs text-muted-foreground">
        {plural(item.sessions, "sessão", "sessões")}
        {item.participation !== null ? ` · participação ${formatPercent(item.participation)}` : ""}
      </span>
    </span>
  );
}

/** "Da biblioteca": escolhe perguntas já usadas e copia para o fim do roteiro desta sessão. */
export function LibraryPicker({ sessionId, items }: { sessionId: string; items: LibraryItem[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const filter = useLibraryFilter(items);

  function toggle(id: string) {
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  function add() {
    startTransition(async () => {
      const result = await copyToSessionAction({ targetSessionId: sessionId, interactionIds: selected });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${plural(result.data.copied, "pergunta adicionada", "perguntas adicionadas")} ao roteiro.`);
      setSelected([]);
      ref.current?.close();
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => ref.current?.showModal()} disabled={items.length === 0}>
        <LibraryIcon /> Da biblioteca
      </Button>
      <dialog
        ref={ref}
        aria-labelledby="library-picker-title"
        className="fixed inset-0 m-auto h-fit max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl rounded-xl border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50"
      >
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b p-5">
            <div>
              <h2 id="library-picker-title" className="text-lg font-semibold">
                Adicionar da biblioteca
              </h2>
              <p className="text-sm text-muted-foreground">Perguntas das suas outras sessões. Elas entram no fim do roteiro.</p>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => ref.current?.close()}
              className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <XIcon />
            </button>
          </div>
          <div className="border-b p-5">
            <LibraryFilters {...filter} />
          </div>
          <ul className="flex-1 divide-y overflow-y-auto">
            {filter.filtered.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">Nenhuma pergunta encontrada.</li>
            ) : (
              filter.filtered.map((item) => (
                <li key={item.key}>
                  <label className="flex cursor-pointer items-start gap-3 px-5 py-3.5 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.sourceId)}
                      onChange={() => toggle(item.sourceId)}
                      className="mt-1 size-4 shrink-0"
                    />
                    <LibraryItemSummary item={item} />
                  </label>
                </li>
              ))
            )}
          </ul>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t p-4">
            <Button variant="outline" onClick={() => ref.current?.close()}>
              Cancelar
            </Button>
            <Button onClick={add} disabled={pending || selected.length === 0}>
              {pending
                ? "Adicionando…"
                : selected.length === 0
                  ? "Escolha perguntas"
                  : `Adicionar ${plural(selected.length, "pergunta", "perguntas")}`}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
