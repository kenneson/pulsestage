"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

/**
 * Substitui `window.confirm` por um `<dialog>` nativo (foco preso, Esc cancela, backdrop).
 * Uso: `const [confirm, dialog] = useConfirm();` renderize `{dialog}` e faça `if (!(await confirm({...}))) return;`.
 */
export function useConfirm() {
  const ref = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });

  function confirm(next: ConfirmOptions): Promise<boolean> {
    resolver.current?.(false);
    setOptions(next);
    const dialog = ref.current;
    if (dialog) {
      // Esc fecha sem alterar returnValue: sem zerar, um "confirm" anterior valeria de novo.
      dialog.returnValue = "";
      dialog.showModal();
    }
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }

  function onClose() {
    resolver.current?.(ref.current?.returnValue === "confirm");
    resolver.current = null;
  }

  const dialog = (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg backdrop:bg-black/50"
    >
      {/* method="dialog": o botão clicado vira o returnValue e o diálogo fecha sozinho. */}
      <form method="dialog" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 id="confirm-dialog-title" className="text-lg font-semibold">
            {options.title}
          </h2>
          {options.description ? <p className="text-sm text-muted-foreground">{options.description}</p> : null}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {/* Foco inicial em Cancelar: Enter acidental não confirma uma ação destrutiva. */}
          <Button type="submit" value="cancel" variant="outline" autoFocus>
            Cancelar
          </Button>
          <Button type="submit" value="confirm" variant={options.destructive ? "destructive" : "default"}>
            {options.confirmLabel ?? "Confirmar"}
          </Button>
        </div>
      </form>
    </dialog>
  );

  return [confirm, dialog] as const;
}
