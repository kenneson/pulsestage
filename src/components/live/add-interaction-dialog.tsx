"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { addLiveInteractionAction } from "@/features/interactions/actions";
import { INTERACTION_TYPES, type InteractionType } from "@/lib/domain/interactions";
import type { DeckItem } from "@/lib/domain/deck";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TYPE_PAPER } from "@/components/interaction-type-tag";
import { PlusIcon, XIcon } from "@/components/icons";
import { emptyDraft, InteractionForm, type InteractionFormAction } from "@/components/builder/interaction-form";
import { ok, type ActionResult } from "@/lib/action-result";
import type { InteractionInput } from "@/lib/domain/interactions";

/**
 * "Nova pergunta" durante a apresentação. A pergunta entra logo depois do que está no telão
 * (vira a próxima) e pode ser lançada na hora. Enquanto o diálogo está aberto, as setas não avançam o deck.
 */
export function AddInteractionDialog({
  sessionId,
  after,
  canLaunch,
  onChanged,
}: {
  sessionId: string;
  /** item no telão (ou o último mostrado) */
  after: DeckItem | null;
  /** só com a sessão ao vivo; pausada, a pergunta fica como a próxima */
  canLaunch: boolean;
  /** depois de criar (ex.: reler o estado ao vivo) */
  onChanged?: () => void;
}) {
  const t = useTranslations("builder.addLive");
  const tCommon = useTranslations("common.actions");
  const tDomain = useTranslations("domain");
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<InteractionType | null>(null);

  function open() {
    setType(null);
    ref.current?.showModal();
  }

  function close() {
    ref.current?.close();
    setType(null);
  }

  async function add(input: InteractionInput, launch: boolean): Promise<ActionResult<{ id: string }>> {
    const result = await addLiveInteractionAction(sessionId, input, { after, launch });
    if (result.ok) {
      toast.success(launch ? t("launched") : t("addedNext"));
      return result;
    }
    // A pergunta já existe: fecha o diálogo para um segundo clique não criar outra igual.
    if (result.code === "created") {
      toast.error(result.error);
      return ok({ id: "" });
    }
    return result;
  }

  const actions: InteractionFormAction[] = [
    { label: t("launchNow"), pendingLabel: t("launching"), disabled: !canLaunch, submit: (input) => add(input, true) },
    {
      label: t("keepNext"),
      pendingLabel: tCommon("saving"),
      variant: "outline",
      submit: (input) => add(input, false),
    },
  ];

  return (
    <>
      <Button variant="outline" size="sm" onClick={open}>
        <PlusIcon /> {t("open")}
      </Button>
      <dialog
        ref={ref}
        onClose={() => setType(null)}
        aria-labelledby="add-interaction-title"
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border bg-card p-6 text-card-foreground shadow-lg backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="add-interaction-title" className="text-lg font-semibold">
                {t("title")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("description")}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label={tCommon("close")} onClick={close}>
              <XIcon />
            </Button>
          </div>

          {type ? (
            <InteractionForm
              key={type}
              sessionId={sessionId}
              initial={emptyDraft(type)}
              actions={actions}
              onDone={() => {
                close();
                router.refresh();
                onChanged?.();
              }}
              onCancel={() => setType(null)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {INTERACTION_TYPES.map((kind) => (
                <Button key={kind} variant="outline" onClick={() => setType(kind)} title={tDomain(`interactionTypes.${kind}.description`)}>
                  <span aria-hidden className={cn("size-2.5 rounded-sm", TYPE_PAPER[kind])} />
                  {tDomain(`interactionTypes.${kind}.label`)}
                </Button>
              ))}
            </div>
          )}
          {!canLaunch ? (
            <p className="text-xs text-muted-foreground">{t("pausedHint")}</p>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
