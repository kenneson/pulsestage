"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { arrangeInteractionsAction, deleteInteractionAction } from "@/features/interactions/actions";
import { moveInteraction } from "@/lib/domain/deck";
import { defaultOption, type PublicInteraction } from "@/lib/domain/interactions";
import { cn } from "@/lib/utils";
import { gapText } from "@/i18n/text";
import { Badge } from "@/components/ui/badge";
import { TypeTag } from "@/components/interaction-type-tag";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/misc";
import { ArrowDownIcon, ArrowUpIcon, EditIcon, EyeIcon, PlusIcon, SparklesIcon, TrashIcon } from "@/components/icons";
import { AnswerForm } from "@/components/participant/answer-form";
import { LibraryPicker } from "@/components/library/library-picker";
import type { LibraryItem } from "@/lib/domain/library";
import { emptyDraft, InteractionForm, type InteractionDraft } from "./interaction-form";
import { InteractionTypePicker } from "./interaction-type-picker";
import { AISuggestionsPanel, useAISuggestions } from "./ai-suggestions";
import { InteractionSummary, NotesBadge } from "./interaction-summary";
import { ContentPreview } from "./content-preview";
import { draftFromInput } from "./draft";

/** Alvo de toque de 44px no celular (no computador, o tamanho do botão continua o mesmo). */
const ICON_MOBILE = "max-md:size-11";

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
  library = [],
  aiEnabled = false,
  slideCount = 0,
}: {
  sessionId: string;
  items: EditorItem[];
  readOnly: boolean;
  library?: LibraryItem[];
  aiEnabled?: boolean;
  /** com slides, subir/descer também muda o ponto da apresentação em que a pergunta entra */
  slideCount?: number;
}) {
  const t = useTranslations("builder.editor");
  const tCommon = useTranslations("common.actions");
  const tDomain = useTranslations("domain");
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  // Pergunta nova em edição; `example` = enquete de exemplo do estado vazio.
  const [creating, setCreating] = useState<{ draft: InteractionDraft; example: boolean } | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  const ai = useAISuggestions(sessionId);

  // Primeira pergunta: enquete já preenchida (no idioma do painel), para editar e salvar.
  function startExample() {
    const draft = emptyDraft("multiple_choice");
    const labels = [t("example.option1"), t("example.option2"), t("example.option3"), t("example.option4")];
    setCreating({
      example: true,
      draft: {
        ...draft,
        title: t("example.question"),
        options: labels.map((label) => ({ ...defaultOption(), label })),
      },
    });
  }

  const refresh = () => {
    setEditing(null);
    setCreating(null);
    router.refresh();
  };

  function move(index: number, delta: -1 | 1) {
    const id = items[index]?.interaction.id;
    const deckItems = items.map((i) => ({ id: i.interaction.id, afterSlide: i.interaction.afterSlide }));
    const arrangement = id ? moveInteraction(deckItems, id, delta, slideCount) : null;
    if (!arrangement) return;
    startTransition(async () => {
      const result = await arrangeInteractionsAction(sessionId, arrangement);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  async function remove(item: EditorItem) {
    const confirmed = await confirm({
      title: t("deleteTitle", { title: item.interaction.title }),
      description: item.responses > 0 ? t("deleteResponses", { count: item.responses }) : undefined,
      confirmLabel: tCommon("delete"),
      destructive: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteInteractionAction(sessionId, item.interaction.id);
      if (!result.ok) toast.error(result.error);
      else toast.success(t("deleted"));
      router.refresh();
    });
  }

  return (
    <div className={cn("grid grid-cols-1 items-start gap-6", ai.open && "lg:grid-cols-[minmax(0,1fr)_22rem]")}>
      <div className="flex flex-col gap-4">
        {confirmDialog}
        {items.length === 0 && !creating ? (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              !readOnly ? (
                <div className="flex flex-col items-center gap-2">
                  <Button onClick={startExample}>
                    <PlusIcon /> {t("createFirstPoll")}
                  </Button>
                  <p className="max-w-sm text-xs text-muted-foreground">{t("createFirstPollHint")}</p>
                </div>
              ) : undefined
            }
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
                {/* No celular, as ações descem para uma linha própria e o texto usa a largura toda do card. */}
                <div className={cn("flex items-start gap-3 p-4", !readOnly && "max-md:flex-wrap max-md:gap-y-2 max-md:pb-2")}>
                  <span className="w-7 shrink-0 pt-0.5 font-display text-xl font-bold leading-none tabular-nums" aria-label={t("cue", { number: index + 1 })}>
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeTag type={interaction.type} />
                      {item.isActive ? <Badge variant="live">{t("active")}</Badge> : null}
                      {item.responses > 0 ? (
                        <span className="text-xs text-muted-foreground">{t("responses", { count: item.responses })}</span>
                      ) : null}
                      <NotesBadge draft={item.draft} />
                      {slideCount > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {gapText(tDomain, interaction.afterSlide, slideCount)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-medium">{interaction.title}</p>
                    <InteractionSummary draft={item.draft} />
                  </div>
                  {/* Só leitura: sobra apenas o olho, que fica ao lado do texto. */}
                  <div
                    className={cn(
                      "flex shrink-0 items-center",
                      readOnly
                        ? "max-md:-my-2 max-md:-mr-2"
                        : "max-md:-mx-2 max-md:w-[calc(100%+1rem)] max-md:gap-1 max-md:border-t max-md:pt-1",
                    )}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(ICON_MOBILE, "max-md:mr-auto")}
                      aria-label={t("preview")}
                      onClick={() => setPreviewing(previewing === interaction.id ? null : interaction.id)}
                    >
                      <EyeIcon />
                    </Button>
                    {!readOnly ? (
                      <>
                        <Button variant="ghost" size="icon" className={ICON_MOBILE} aria-label={t("moveUp")} disabled={pending || index === 0} onClick={() => move(index, -1)}>
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={ICON_MOBILE}
                          aria-label={t("moveDown")}
                          disabled={pending || index === items.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDownIcon />
                        </Button>
                        <Button variant="ghost" size="icon" className={ICON_MOBILE} aria-label={tCommon("edit")} onClick={() => setEditing(interaction.id)}>
                          <EditIcon />
                        </Button>
                        <Button variant="ghost" size="icon" className={ICON_MOBILE} aria-label={tCommon("delete")} disabled={pending} onClick={() => remove(item)}>
                          <TrashIcon />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                {previewing === interaction.id ? (
                  <div className="border-t bg-muted/40 p-4">
                    <div className="mx-auto max-w-sm rounded-2xl border bg-background p-5 shadow-sm">
                      {interaction.type === "content" ? (
                        <ContentPreview
                          title={interaction.title}
                          body={interaction.settings.body}
                          imagePath={interaction.settings.imagePath}
                          videoUrl={interaction.settings.videoUrl}
                        />
                      ) : (
                        <>
                          <p className="mb-4 text-lg font-semibold">{interaction.title}</p>
                          <AnswerForm interaction={interaction} onSubmit={() => undefined} preview />
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        {creating ? (
          <div className="flex flex-col gap-2">
            {creating.example ? <p className="text-sm text-muted-foreground">{t("exampleHint")}</p> : null}
            <InteractionForm
              key={`${creating.draft.type}-${creating.example ? "example" : "new"}-${creating.draft.title}`}
              sessionId={sessionId}
              initial={creating.draft}
              onDone={refresh}
              onCancel={() => setCreating(null)}
            />
          </div>
        ) : !readOnly ? (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <PlusIcon /> {t("addInteraction")}
            </p>
            <InteractionTypePicker onPick={(type) => setCreating({ draft: emptyDraft(type), example: false })} />
            <div className="flex flex-wrap items-center gap-2 border-t pt-3 max-md:grid max-md:grid-cols-1 max-md:[&>button]:h-11 max-md:[&>span>button]:h-11">
              <LibraryPicker sessionId={sessionId} items={library} />
              {aiEnabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary/60 text-primary"
                  disabled={ai.loading}
                  onClick={ai.generate}
                >
                  <SparklesIcon /> {t("generateWithAI")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {ai.open && !readOnly ? <AISuggestionsPanel
          sessionId={sessionId}
          ai={ai}
          onAdded={() => router.refresh()}
          onEdit={(suggestion) => setCreating({ draft: draftFromInput(suggestion), example: false })}
        /> : null}
    </div>
  );
}
