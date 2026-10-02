"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

export function OpenTextList({ items, emptyText = "Nenhuma resposta." }: { items: string[]; emptyText?: string }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return q ? items.filter((t) => t.toLocaleLowerCase("pt-BR").includes(q)) : items;
  }, [items, query]);

  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <div className="flex flex-col gap-3">
      {items.length > 5 ? (
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nas respostas" aria-label="Buscar" />
      ) : null}
      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
        {filtered.map((text, index) => (
          <li key={`${index}-${text.slice(0, 20)}`} className="rounded-lg border bg-background px-3 py-2 text-sm">
            {text}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {filtered.length} de {items.length}
      </p>
    </div>
  );
}
