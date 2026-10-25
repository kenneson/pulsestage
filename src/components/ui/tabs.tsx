"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Tab = { id: string; label: string; content: React.ReactNode };

export function Tabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [active, setActive] = React.useState(defaultTab ?? tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const listRef = React.useRef<HTMLDivElement>(null);
  const firstRun = React.useRef(true);

  // Faixa estreita (celular): a aba ativa rola para a vista. Só na horizontal e só dentro da faixa:
  // `scrollIntoView` também rolaria a página. Sem sobra (computador), não faz nada.
  React.useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    const pad = 16;
    const left = tab.offsetLeft; // a faixa é `relative`: offsetLeft já é dentro dela
    const right = left + tab.offsetWidth;
    let target: number | null = null;
    if (left - pad < list.scrollLeft) target = left - pad;
    else if (right + pad > list.scrollLeft + list.clientWidth) target = right + pad - list.clientWidth;
    if (target !== null) list.scrollTo({ left: Math.max(0, target), behavior: firstRun.current ? "auto" : "smooth" });
    firstRun.current = false;
  }, [current?.id]);

  return (
    <div className="flex flex-col gap-4">
      {/* No celular as abas não cabem: a faixa rola na horizontal (com encaixe e sem barra visível) em vez de estourar a página. */}
      <div
        ref={listRef}
        role="tablist"
        className="relative flex w-fit max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-lg bg-muted p-1 [scrollbar-width:thin] max-md:snap-x max-md:snap-mandatory max-md:scroll-px-1 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === current?.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors max-md:min-h-11 max-md:snap-start max-md:px-4",
              tab.id === current?.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
