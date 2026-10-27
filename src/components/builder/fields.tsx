"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ChevronRightIcon } from "@/components/icons";

/**
 * Número editável como texto (dá para apagar e digitar "-" sem o campo pular). Só repassa valores válidos;
 * ao sair do campo, um texto inválido volta para o último valor válido (o que aparece é o que vai ser salvo).
 * Com `allowEmpty`, vazio vira null.
 */
export function NumberInput({
  value,
  onChange,
  allowEmpty = false,
  integer = false,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (value: number | null) => void;
  allowEmpty?: boolean;
  integer?: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [synced, setSynced] = useState(value);
  // Valor trocado por fora (ex.: limites ajustados): mostra o novo.
  if (value !== synced) {
    setSynced(value);
    if (Number(text) !== value) setText(value === null ? "" : String(value));
  }

  function parse(raw: string): number | null | undefined {
    const trimmed = raw.trim().replace(",", ".");
    if (trimmed === "") return allowEmpty ? null : undefined;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || (integer && !Number.isInteger(n))) return undefined;
    return n;
  }

  return (
    <Input
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = parse(e.target.value);
        if (n !== undefined) {
          setSynced(n);
          onChange(n);
        }
      }}
      onBlur={() => {
        if (parse(text) === undefined) setText(value === null ? "" : String(value));
      }}
      className={cn("tabular-nums", className)}
      {...props}
    />
  );
}

/** Caixa de marcar com texto e dica, alvo de 44 px no celular. */
export function CheckboxRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-start gap-2.5 text-sm max-md:min-h-11 max-md:py-1", disabled ? "opacity-60" : "cursor-pointer")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)] max-md:mt-0.5 max-md:size-5"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium leading-snug">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Seção recolhível do formulário ("Mais ajustes", "Notas do palestrante"). */
export function Collapsible({
  title,
  hint,
  defaultOpen = false,
  children,
  icon,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg border" open={defaultOpen || undefined}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon aria-hidden className="shrink-0 transition-transform group-open:rotate-90" />
        {icon}
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">{title}</span>
          {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t p-3 md:p-4">{children}</div>
    </details>
  );
}
