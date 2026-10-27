"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createFromTemplateAction } from "@/features/templates/actions";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Cria a sessão a partir do modelo e abre o editor (a action redireciona).
 * Os rótulos vêm do servidor: a área "templates" não precisa ir para o navegador.
 */
export function UseTemplateButton({
  templateId,
  label,
  pendingLabel,
  className,
}: {
  templateId: string;
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      aria-busy={pending}
      className={cn("max-md:w-full", className)}
      onClick={() =>
        startTransition(async () => {
          const result = await createFromTemplateAction(templateId);
          // Sucesso não volta: a action redireciona para o editor.
          if (result && !result.ok) toast.error(result.error);
        })
      }
    >
      <PlusIcon /> {pending ? pendingLabel : label}
    </Button>
  );
}
