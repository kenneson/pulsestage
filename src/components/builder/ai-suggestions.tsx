"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveInteractionAction, suggestInteractionsAction } from "@/features/interactions/actions";
import type { ParsedInteractionInput } from "@/lib/domain/interactions";
import { TypeTag } from "@/components/interaction-type-tag";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/misc";
import { EditIcon, PlusIcon, RefreshIcon, SparklesIcon, XIcon } from "@/components/icons";

export function useAISuggestions(sessionId: string) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ParsedInteractionInput[]>([]);
  // Tudo que já foi mostrado: "Gerar outras sugestões" pede perguntas novas.
  const [shown, setShown] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  function generate() {
    setOpen(true);
    setError(null);
    startLoading(async () => {
      const result = await suggestInteractionsAction(sessionId, shown.slice(-40));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuggestions(result.data.suggestions);
      setShown((prev) => [...prev, ...result.data.suggestions.map((s) => s.title)]);
    });
  }

  return { open, close: () => setOpen(false), suggestions, setSuggestions, error, loading, generate };
}

type AIT = ReturnType<typeof useTranslations<"builder.ai">>;

function detail(t: AIT, s: ParsedInteractionInput): string | null {
  switch (s.type) {
    case "multiple_choice":
      return s.options.map((o) => o.label).join(" · ");
    case "quiz":
      return s.options.map((o) => (o.isCorrect ? `${o.label} ✓` : o.label)).join(" · ");
    case "rating":
      return [t("ratingRange", { min: s.settings.min, max: s.settings.max }), s.settings.minLabel, s.settings.maxLabel].filter(Boolean).join(" · ");
    case "ranking":
    case "points_100":
      return s.options.map((o) => o.label).join(" · ");
    case "matrix_2x2":
      return [s.settings.xLabel && s.settings.yLabel ? `${s.settings.xLabel} × ${s.settings.yLabel}` : null, s.options.map((o) => o.label).join(" · ")]
        .filter(Boolean)
        .join(" · ");
    case "guess_number":
      return [t("ratingRange", { min: s.settings.numMin, max: s.settings.numMax }), s.settings.unit, t("answer", { value: s.answerKey.value })]
        .filter(Boolean)
        .join(" · ");
    case "quiz_text":
      return s.answerKey.accepted.map((a) => `${a} ✓`).join(" · ");
    case "content":
      return s.settings.body ? s.settings.body.slice(0, 160) : null;
    default:
      return null;
  }
}

export function AISuggestionsPanel({
  sessionId,
  ai,
  onAdded,
  onEdit,
}: {
  sessionId: string;
  ai: ReturnType<typeof useAISuggestions>;
  onAdded: () => void;
  /** abre a sugestão no formulário (obrigatório para "Marcar na imagem", que precisa da imagem) */
  onEdit?: (suggestion: ParsedInteractionInput) => void;
}) {
  const t = useTranslations("builder.ai");
  const [adding, setAdding] = useState<string | null>(null);

  async function add(suggestion: ParsedInteractionInput) {
    setAdding(suggestion.title);
    const result = await saveInteractionAction(sessionId, null, suggestion);
    setAdding(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(t("added"));
    ai.setSuggestions((list) => list.filter((s) => s !== suggestion));
    onAdded();
  }

  return (
    <aside aria-labelledby="ai-suggestions" aria-busy={ai.loading} className="flex flex-col gap-4 self-start rounded-xl border bg-card p-5 lg:sticky lg:top-6 max-md:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="ai-suggestions" className="flex items-center gap-2 font-semibold">
            <SparklesIcon className="text-primary" /> {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button variant="ghost" size="icon" className="max-md:-mr-2 max-md:-mt-2 max-md:size-11" aria-label={t("close")} onClick={ai.close}>
          <XIcon />
        </Button>
      </div>

      {ai.loading ? (
        <div className="flex flex-col gap-2.5" aria-label={t("generating")}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : ai.error ? (
        <Alert>{ai.error}</Alert>
      ) : ai.suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("allAdded")}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {ai.suggestions.map((s) => {
            const extra = detail(t, s);
            return (
              <li key={s.title} className="flex flex-col gap-2 rounded-md border p-3">
                <TypeTag type={s.type} />
                <p className="text-sm font-medium">{s.title}</p>
                {extra ? <p className="text-sm text-muted-foreground">{extra}</p> : null}
                {s.type === "pin_image" ? <p className="text-xs text-muted-foreground">{t("needsImage")}</p> : null}
                <div className="flex flex-wrap gap-2 max-md:grid max-md:grid-cols-1">
                  {s.type !== "pin_image" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit max-md:h-11 max-md:w-full max-md:text-sm"
                      disabled={adding !== null}
                      onClick={() => add(s)}
                    >
                      <PlusIcon /> {adding === s.title ? t("adding") : t("addToLineup")}
                    </Button>
                  ) : null}
                  {onEdit ? (
                    <Button
                      variant={s.type === "pin_image" ? "outline" : "ghost"}
                      size="sm"
                      className="w-fit max-md:h-11 max-md:w-full max-md:text-sm"
                      disabled={adding !== null}
                      onClick={() => {
                        ai.setSuggestions((list) => list.filter((item) => item !== s));
                        onEdit(s);
                      }}
                    >
                      <EditIcon /> {t("editFirst")}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="outline" className="max-md:h-11" onClick={ai.generate} disabled={ai.loading}>
        <RefreshIcon /> {t("regenerate")}
      </Button>
    </aside>
  );
}
