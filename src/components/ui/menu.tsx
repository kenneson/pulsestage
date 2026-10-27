"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export type MenuItem = {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

/**
 * Menu de ações secundárias ("⋯"): botão que abre uma lista. Fecha ao escolher, com Esc ou com clique fora;
 * setas ↑/↓ andam entre os itens. Os itens só disparam callbacks: diálogos ficam fora do menu (o menu
 * fecha antes de o diálogo abrir).
 */
export function Menu({
  label,
  trigger,
  items,
  className,
  triggerClassName,
}: {
  /** nome acessível do botão */
  label: string;
  /** conteúdo do botão (ícone e, se quiser, texto) */
  trigger: React.ReactNode;
  items: MenuItem[];
  className?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus();
    function onPointer(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const entries = [...(list.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])];
    const at = entries.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? (at + 1) % entries.length : (at - 1 + entries.length) % entries.length;
    entries[next]?.focus();
  }

  return (
    <div ref={root} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <Button
        ref={button}
        variant="outline"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={triggerClassName}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </Button>
      {open ? (
        <div
          ref={list}
          id={id}
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-40 mt-1.5 flex min-w-52 flex-col rounded-lg border bg-card p-1 text-card-foreground shadow-lg max-md:left-0 max-md:right-auto max-md:w-full"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted disabled:opacity-50 max-md:min-h-11 [&_svg]:shrink-0",
                item.destructive ? "text-destructive" : "text-foreground",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
