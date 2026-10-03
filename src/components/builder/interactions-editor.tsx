"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteInteractionAction, reorderInteractionsAction } from "@/features/interactions/actions";
import {
  INTERACTION_TYPE_META,
  INTERACTION_TYPES,
  type InteractionType,
  type PublicInteraction,
} from "@/lib/domain/interactions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/misc";
import { ArrowDownIcon, ArrowUpIcon, EditIcon, EyeIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { AnswerForm } from "@/components/participant/answer-form";
import { emptyDraft, InteractionForm, type InteractionDraft } from "./interaction-form";

export type EditorItem = {
  interaction: PublicInteraction;
  draft: InteractionDraft;
  responses: number;
  isActive: boolean;
};

export function InteractionsEditor({
  sessionId,
  items,
  readOnly,
}: {
  sessionId: string;
  items: EditorItem[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState<InteractionType | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();

  const refresh = () => {
    setEditing(null);
    setCreating(null);
    router.refresh();
  };

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((i) => i.interaction.id);
    const a = ids[index];
    const b = ids[target];
    if (!a || !b) return;
    ids[index] = b;
    ids[target] = a;
    startTransition(async () => {
      const result = await reorderInteractionsAction(sessionId, ids);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  async function remove(item: EditorItem) {
    const confirmed = await confirm({
      title: `Excluir "${item.interaction.title}"?`,
      description: item.responses > 0 ? `As ${item.responses} respostas também serão apagadas.` : undefined,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteInteractionAction(sessionId, item.interaction.id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Interação excluída.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {confirmDialog}
      {items.length === 0 && !creating ? (
        <EmptyState
          title="Nenhuma interação"
          description="Adicione enquetes, quizzes, escalas, nuvens de palavras ou perguntas abertas."
        />
      ) : null}

      <ol className="flex flex-col gap-3">
        {items.map((item, index) => {
          const { interaction } = item;
          if (editing === interaction.id) {
            return (
              <li key={interaction.id}>
                <InteractionForm
                  sessionId={sessionId}
                  initial={item.draft}
                  locked={item.responses > 0}
                  onDone={refresh}
                  onCancel={() => setEditing(null)}
                />
              </li>
            );
          }
          return (
            <li key={interaction.id} className="rounded-xl border bg-background">
              <div className="flex items-start gap-3 p-4">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-sm font-semibold">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{INTERACTION_TYPE_META[interaction.type].label}</Badge>
                    {item.isActive ? <Badge variant="live">Ativa</Badge> : null}
                    {item.responses > 0 ? (
                      <span className="text-xs text-muted-foreground">{item.responses} respostas</span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-medium">{interaction.title}</p>
                  {interaction.options.length > 0 ? (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {interaction.options.map((o) => o.label).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Pré-visualizar"
                    onClick={() => setPreviewing(previewing === interaction.id ? null : interaction.id)}
                  >
                    <EyeIcon />
                  </Button>
                  {!readOnly ? (
                    <>
                      <Button variant="ghost" size="icon" aria-label="Subir" disabled={pending || index === 0} onClick={() => move(index, -1)}>
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Descer"
                        disabled={pending || index === items.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDownIcon />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(interaction.id)}>
                        <EditIcon />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Excluir" disabled={pending} onClick={() => remove(item)}>
                        <TrashIcon />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              {previewing === interaction.id ? (
                <div className="border-t bg-muted/40 p-4">
                  <div className="mx-auto max-w-sm rounded-2xl border bg-background p-5 shadow-sm">
                    <p className="mb-4 text-lg font-semibold">{interaction.title}</p>
                    <AnswerForm interaction={interaction} onSubmit={() => undefined} preview />
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {creating ? (
        <InteractionForm
          key={creating}
          sessionId={sessionId}
          initial={emptyDraft(creating)}
          onDone={refresh}
          onCancel={() => setCreating(null)}
        />
      ) : !readOnly ? (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <PlusIcon /> Adicionar interação
          </p>
          <div className="flex flex-wrap gap-2">
            {INTERACTION_TYPES.map((type) => (
              <Button key={type} variant="outline" size="sm" onClick={() => setCreating(type)} title={INTERACTION_TYPE_META[type].description}>
                {INTERACTION_TYPE_META[type].label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
