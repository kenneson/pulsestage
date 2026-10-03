"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveInteractionAction, suggestInteractionsAction } from "@/features/interactions/actions";
import type { ParsedInteractionInput } from "@/lib/domain/interactions";
import { TypeTag } from "@/components/interaction-type-tag";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/misc";
import { PlusIcon, RefreshIcon, SparklesIcon, XIcon } from "@/components/icons";

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

function detail(s: ParsedInteractionInput): string | null {
  switch (s.type) {
    case "multiple_choice":
      return s.options.map((o) => o.label).join(" · ");
    case "quiz":
      return s.options.map((o) => (o.isCorrect ? `${o.label} ✓` : o.label)).join(" · ");
    case "rating":
      return [`De ${s.settings.min} a ${s.settings.max}`, s.settings.minLabel, s.settings.maxLabel].filter(Boolean).join(" · ");
    default:
      return null;
  }
}

export function AISuggestionsPanel({
  sessionId,
  ai,
  onAdded,
}: {
  sessionId: string;
  ai: ReturnType<typeof useAISuggestions>;
  onAdded: () => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);

  async function add(suggestion: ParsedInteractionInput) {
    setAdding(suggestion.title);
    const result = await saveInteractionAction(sessionId, null, suggestion);
    setAdding(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Pergunta adicionada ao roteiro.");
    ai.setSuggestions((list) => list.filter((s) => s !== suggestion));
    onAdded();
  }

  return (
    <aside aria-labelledby="ai-suggestions" aria-busy={ai.loading} className="flex flex-col gap-4 self-start rounded-xl border bg-card p-5 lg:sticky lg:top-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="ai-suggestions" className="flex items-center gap-2 font-semibold">
            <SparklesIcon className="text-primary" /> Sugestões da IA
          </h2>
          <p className="text-sm text-muted-foreground">A partir do título e da descrição da sessão. Revise antes de usar.</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Fechar sugestões" onClick={ai.close}>
          <XIcon />
        </Button>
      </div>

      {ai.loading ? (
        <div className="flex flex-col gap-2.5" aria-label="Gerando sugestões">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : ai.error ? (
        <Alert>{ai.error}</Alert>
      ) : ai.suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todas as sugestões foram para o roteiro. Gere outras se quiser mais.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {ai.suggestions.map((s) => {
            const extra = detail(s);
            return (
              <li key={s.title} className="flex flex-col gap-2 rounded-md border p-3">
                <TypeTag type={s.type} />
                <p className="text-sm font-medium">{s.title}</p>
                {extra ? <p className="text-sm text-muted-foreground">{extra}</p> : null}
                <Button variant="outline" size="sm" className="w-fit" disabled={adding !== null} onClick={() => add(s)}>
                  <PlusIcon /> {adding === s.title ? "Adicionando..." : "Adicionar ao roteiro"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="outline" onClick={ai.generate} disabled={ai.loading}>
        <RefreshIcon /> Gerar outras sugestões
      </Button>
    </aside>
  );
}
