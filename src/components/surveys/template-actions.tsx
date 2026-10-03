"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSurveyTemplateAction, duplicateSurveyTemplateAction } from "@/features/surveys/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TrashIcon } from "@/components/icons";

export function DuplicateTemplateButton({ templateId, label = "Duplicar e editar" }: { templateId: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // Em caso de sucesso a action redireciona para o editor da cópia.
          const result = await duplicateSurveyTemplateAction(templateId);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      {pending ? "Duplicando…" : label}
    </Button>
  );
}

export function DeleteTemplateButton({ templateId, name }: { templateId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
      {confirmDialog}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-destructive hover:text-destructive"
        onClick={async () => {
          const confirmed = await confirm({
            title: `Excluir o modelo “${name}”?`,
            description:
              "Sessões que ainda não terminaram e usavam este modelo passam a usar a “Avaliação geral”. Relatórios de sessões encerradas não mudam.",
            confirmLabel: "Excluir",
            destructive: true,
          });
          if (!confirmed) return;
          startTransition(async () => {
            const result = await deleteSurveyTemplateAction(templateId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Modelo excluído.");
            router.refresh();
          });
        }}
      >
        <TrashIcon /> Excluir
      </Button>
    </>
  );
}
