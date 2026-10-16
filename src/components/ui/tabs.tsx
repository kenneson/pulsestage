"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Tab = { id: string; label: string; content: React.ReactNode };

export function Tabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [active, setActive] = React.useState(defaultTab ?? tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className="flex flex-col gap-4">
      {/* No celular as abas não cabem: a faixa rola na horizontal em vez de estourar a página. */}
      <div
        role="tablist"
        className="flex w-fit max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-lg bg-muted p-1 [scrollbar-width:thin]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === current?.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
