"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteSurveyTemplateAction, duplicateSurveyTemplateAction } from "@/features/surveys/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { TrashIcon } from "@/components/icons";

export function DuplicateTemplateButton({ templateId, label }: { templateId: string; label?: string }) {
  const t = useTranslations("surveys.templateActions");
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
      {pending ? t("duplicating") : (label ?? t("duplicateAndEdit"))}
    </Button>
  );
}

export function DeleteTemplateButton({ templateId, name }: { templateId: string; name: string }) {
  const t = useTranslations("surveys.templateActions");
  const tCommon = useTranslations("common.actions");
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
            title: t("deleteTitle", { name }),
            description: t("deleteDescription"),
            confirmLabel: tCommon("delete"),
            destructive: true,
          });
          if (!confirmed) return;
          startTransition(async () => {
            const result = await deleteSurveyTemplateAction(templateId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(t("deleted"));
            router.refresh();
          });
        }}
      >
        <TrashIcon /> {tCommon("delete")}
      </Button>
    </>
  );
}
