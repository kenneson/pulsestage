"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveInteractionAction } from "@/features/interactions/actions";
import {
  hasOptions,
  INTERACTION_TYPE_META,
  interactionInputSchema,
  type InteractionInput,
  type InteractionType,
  type NormalizedSettings,
} from "@/lib/domain/interactions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { PlusIcon, TrashIcon } from "@/components/icons";

export type EditableOption = { id?: string; label: string; isCorrect: boolean; points: number };

export type InteractionDraft = {
  id: string | null;
  type: InteractionType;
  title: string;
  description: string;
  settings: NormalizedSettings;
  options: EditableOption[];
};

export function emptyDraft(type: InteractionType): InteractionDraft {
  return {
    id: null,
    type,
    title: "",
    description: "",
    settings: {
      min: 1,
      max: 5,
      minLabel: null,
      maxLabel: null,
      maxLength: type === "word_cloud" ? 30 : 280,
      showOnDisplay: true,
      timerSeconds: type === "quiz" ? 30 : null,
    },
    options: hasOptions(type)
      ? [
          { label: "", isCorrect: type === "quiz", points: 100 },
          { label: "", isCorrect: false, points: 100 },
        ]
      : [],
  };
}

function toInput(draft: InteractionDraft): InteractionInput {
  const base = { title: draft.title, description: draft.description || undefined };
  const options = draft.options.map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect, points: o.points }));
  const s = draft.settings;
  switch (draft.type) {
    case "multiple_choice":
      return { type: "multiple_choice", ...base, settings: {}, options };
    case "quiz":
      return { type: "quiz", ...base, settings: { timerSeconds: s.timerSeconds }, options };
    case "rating":
      return {
        type: "rating",
        ...base,
        settings: { min: s.min, max: s.max, minLabel: s.minLabel ?? undefined, maxLabel: s.maxLabel ?? undefined },
      };
    case "word_cloud":
      return { type: "word_cloud", ...base, settings: { maxLength: s.maxLength } };
    case "open_text":
      return { type: "open_text", ...base, settings: { maxLength: s.maxLength, showOnDisplay: s.showOnDisplay } };
  }
}

export function InteractionForm({
  sessionId,
  initial,
  locked,
  onDone,
  onCancel,
}: {
  sessionId: string;
  initial: InteractionDraft;
  /** Já existem respostas: estrutura das alternativas não pode mudar. */
  locked?: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<InteractionDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const meta = INTERACTION_TYPE_META[draft.type];

  const setSettings = (patch: Partial<NormalizedSettings>) =>
    setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  const setOption = (index: number, patch: Partial<EditableOption>) =>
    setDraft((d) => ({
      ...d,
      options: d.options.map((o, i) =>
        i === index ? { ...o, ...patch } : patch.isCorrect && d.type === "quiz" ? { ...o, isCorrect: false } : o,
      ),
    }));

  function save() {
    const input = toInput(draft);
    const check = interactionInputSchema.safeParse(input);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Revise os campos.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveInteractionAction(sessionId, draft.id, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(draft.id ? "Interação atualizada." : "Interação criada.");
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-background p-4">
      <p className="text-sm font-medium text-primary">{meta.label}</p>

      <Field>
        <Label htmlFor="interaction-title">Pergunta</Label>
        <Input
          id="interaction-title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          maxLength={300}
          placeholder="Você já utiliza IA no seu trabalho?"
          autoFocus
        />
      </Field>

      <Field>
        <Label htmlFor="interaction-description">Descrição (opcional)</Label>
        <Textarea
          id="interaction-description"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          maxLength={1000}
          className="min-h-14"
        />
      </Field>

      {hasOptions(draft.type) ? (
        <div className="flex flex-col gap-2">
          <Label>Alternativas{draft.type === "quiz" ? " (marque a correta)" : ""}</Label>
          {draft.options.map((option, index) => (
            <div key={option.id ?? `new-${index}`} className="flex items-center gap-2">
              {draft.type === "quiz" ? (
                <input
                  type="radio"
                  name="correct-option"
                  aria-label={`Alternativa ${index + 1} é a correta`}
                  checked={option.isCorrect}
                  onChange={() => setOption(index, { isCorrect: true })}
                  disabled={locked}
                  className="size-4 accent-[var(--primary)]"
                />
              ) : null}
              <Input
                value={option.label}
                onChange={(e) => setOption(index, { label: e.target.value })}
                placeholder={`Alternativa ${index + 1}`}
                maxLength={200}
              />
              {draft.type === "quiz" ? (
                <Input
                  type="number"
                  aria-label="Pontos"
                  title="Pontos se acertar"
                  value={option.points}
                  min={0}
                  max={10000}
                  onChange={(e) => setOption(index, { points: Number(e.target.value) || 0 })}
                  className="w-24"
                  disabled={locked}
                />
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover alternativa"
                disabled={locked || draft.options.length <= 2}
                onClick={() => setDraft({ ...draft, options: draft.options.filter((_, i) => i !== index) })}
              >
                <TrashIcon />
              </Button>
            </div>
          ))}
          <div>
            <Button
              variant="outline"
              size="sm"
              disabled={locked || draft.options.length >= (draft.type === "quiz" ? 6 : 8)}
              onClick={() =>
                setDraft({ ...draft, options: [...draft.options, { label: "", isCorrect: false, points: 100 }] })
              }
            >
              <PlusIcon /> Alternativa
            </Button>
          </div>
          {locked ? (
            <p className="text-xs text-muted-foreground">
              Já existem respostas: você pode corrigir o texto, mas não adicionar, remover ou trocar a correta.
            </p>
          ) : null}
        </div>
      ) : null}

      {draft.type === "quiz" ? (
        <Field className="max-w-xs">
          <Label htmlFor="quiz-timer">Tempo para responder</Label>
          <Select
            id="quiz-timer"
            value={draft.settings.timerSeconds ?? 0}
            onChange={(e) => setSettings({ timerSeconds: Number(e.target.value) || null })}
          >
            <option value={0}>Sem limite</option>
            {[10, 15, 20, 30, 45, 60, 90].map((s) => (
              <option key={s} value={s}>
                {s} segundos
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {draft.type === "rating" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label htmlFor="rating-min">Mínimo</Label>
            <Select id="rating-min" value={draft.settings.min} onChange={(e) => setSettings({ min: Number(e.target.value) })}>
              <option value={0}>0</option>
              <option value={1}>1</option>
            </Select>
          </Field>
          <Field>
            <Label htmlFor="rating-max">Máximo</Label>
            <Select id="rating-max" value={draft.settings.max} onChange={(e) => setSettings({ max: Number(e.target.value) })}>
              {[3, 4, 5, 7, 10].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="rating-min-label">Rótulo do mínimo</Label>
            <Input
              id="rating-min-label"
              value={draft.settings.minLabel ?? ""}
              onChange={(e) => setSettings({ minLabel: e.target.value || null })}
              placeholder="Nada"
              maxLength={40}
            />
          </Field>
          <Field>
            <Label htmlFor="rating-max-label">Rótulo do máximo</Label>
            <Input
              id="rating-max-label"
              value={draft.settings.maxLabel ?? ""}
              onChange={(e) => setSettings({ maxLabel: e.target.value || null })}
              placeholder="Muito"
              maxLength={40}
            />
          </Field>
        </div>
      ) : null}

      {draft.type === "word_cloud" || draft.type === "open_text" ? (
        <div className="flex flex-wrap items-end gap-4">
          <Field className="w-40">
            <Label htmlFor="max-length">Limite de caracteres</Label>
            <Input
              id="max-length"
              type="number"
              min={draft.type === "word_cloud" ? 5 : 20}
              max={draft.type === "word_cloud" ? 50 : 500}
              value={draft.settings.maxLength}
              onChange={(e) => setSettings({ maxLength: Number(e.target.value) || 0 })}
            />
          </Field>
          {draft.type === "open_text" ? (
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={draft.settings.showOnDisplay}
                onChange={(e) => setSettings({ showOnDisplay: e.target.checked })}
                className="size-4"
              />
              Mostrar respostas na tela do projetor
            </label>
          ) : null}
        </div>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}

      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
