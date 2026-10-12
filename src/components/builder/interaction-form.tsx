"use client";

import { useRef, useState, useTransition } from "react";
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
import { ImageIcon, PlusIcon, TrashIcon, XIcon } from "@/components/icons";
import { ShapeGlyph, shapeText } from "@/components/option-shape";
import { optionImageSrc } from "@/lib/option-images/url";
import { OptionImageError, uploadOptionImage } from "@/lib/option-images/upload";
import type { ActionResult } from "@/lib/action-result";

export type EditableOption = { id?: string; label: string; isCorrect: boolean; points: number; imagePath: string | null };

const newOption = (isCorrect = false): EditableOption => ({ label: "", isCorrect, points: 100, imagePath: null });

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
      // Quiz novo já nasce no estilo Kahoot; enquete continua em texto.
      optionStyle: type === "quiz" ? "shapes" : "text",
      speedBonus: type === "quiz",
    },
    options: hasOptions(type) ? [newOption(type === "quiz"), newOption()] : [],
  };
}

function toInput(draft: InteractionDraft): InteractionInput {
  const base = { title: draft.title, description: draft.description || undefined };
  const options = draft.options.map((o) => ({
    id: o.id,
    label: o.label,
    isCorrect: o.isCorrect,
    points: o.points,
    imagePath: o.imagePath,
  }));
  const s = draft.settings;
  switch (draft.type) {
    case "multiple_choice":
      return { type: "multiple_choice", ...base, settings: { optionStyle: s.optionStyle }, options };
    case "quiz":
      return {
        type: "quiz",
        ...base,
        settings: { timerSeconds: s.timerSeconds, optionStyle: s.optionStyle, speedBonus: s.speedBonus },
        options,
      };
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

/** Imagem opcional da alternativa: miniatura com "remover" ou botão para escolher o arquivo. */
function OptionImagePicker({
  path,
  index,
  onChange,
  onBusy,
}: {
  path: string | null;
  index: number;
  onChange: (path: string | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(file: File) {
    setUploading(true);
    onBusy(true);
    try {
      onChange(await uploadOptionImage(file));
    } catch (e) {
      toast.error(e instanceof OptionImageError ? e.message : "Falha ao enviar a imagem.");
    } finally {
      setUploading(false);
      onBusy(false);
    }
  }

  if (path) {
    return (
      <span className="relative shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem pública do Storage */}
        <img src={optionImageSrc(path)} alt="" className="size-10 rounded-md border object-cover" />
        <button
          type="button"
          aria-label={`Remover imagem da alternativa ${index + 1}`}
          onClick={() => onChange(null)}
          className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
        >
          <XIcon width={12} height={12} />
        </button>
      </span>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Adicionar imagem à alternativa ${index + 1}`}
        title="Adicionar imagem"
        disabled={uploading}
        onClick={() => input.current?.click()}
      >
        {uploading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <ImageIcon />}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
    </>
  );
}

/** Botão de salvar alternativo (ex.: sala ao vivo: "Lançar agora" e "Deixar como próxima"). */
export type InteractionFormAction = {
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline";
  disabled?: boolean;
  submit: (input: InteractionInput) => Promise<ActionResult<{ id: string }>>;
};

export function InteractionForm({
  sessionId,
  initial,
  locked,
  onDone,
  onCancel,
  actions,
}: {
  sessionId: string;
  initial: InteractionDraft;
  /** Já existem respostas: estrutura das alternativas não pode mudar. */
  locked?: boolean;
  onDone: () => void;
  onCancel: () => void;
  /** Sem `actions`, há um único "Salvar" que cria ou edita pelo roteiro. */
  actions?: InteractionFormAction[];
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

  const defaultAction: InteractionFormAction = {
    label: "Salvar",
    pendingLabel: "Salvando…",
    submit: (input) => saveInteractionAction(sessionId, draft.id, input),
  };
  const formActions = actions ?? [defaultAction];
  const [running, setRunning] = useState<string | null>(null);
  // Imagens subindo: salvar agora perderia a imagem.
  const [uploads, setUploads] = useState(0);
  const onBusy = (busy: boolean) => setUploads((n) => n + (busy ? 1 : -1));

  function save(action: InteractionFormAction) {
    const input = toInput(draft);
    const check = interactionInputSchema.safeParse(input);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Revise os campos.");
      return;
    }
    setError(null);
    setRunning(action.label);
    startTransition(async () => {
      const result = await action.submit(input);
      setRunning(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!actions) toast.success(draft.id ? "Interação atualizada." : "Interação criada.");
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
        <Field className="max-w-xs">
          <Label htmlFor="option-style">Aparência das alternativas</Label>
          <Select
            id="option-style"
            value={draft.settings.optionStyle}
            onChange={(e) => setSettings({ optionStyle: e.target.value === "shapes" ? "shapes" : "text" })}
          >
            <option value="text">Texto</option>
            <option value="shapes">Formas e cores</option>
          </Select>
        </Field>
      ) : null}

      {hasOptions(draft.type) ? (
        <div className="flex flex-col gap-2">
          <Label>Alternativas{draft.type === "quiz" ? " (marque a correta)" : ""}</Label>
          {draft.options.map((option, index) => (
            <div key={option.id ?? `new-${index}`} className="flex items-center gap-2">
              {draft.settings.optionStyle === "shapes" ? <ShapeGlyph index={index} className={shapeText(index)} /> : null}
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
                placeholder={option.imagePath ? "Descreva a imagem" : `Alternativa ${index + 1}`}
                aria-label={`Alternativa ${index + 1}`}
                maxLength={200}
              />
              <OptionImagePicker
                path={option.imagePath}
                index={index}
                onChange={(imagePath) => setOption(index, { imagePath })}
                onBusy={onBusy}
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
                setDraft({ ...draft, options: [...draft.options, newOption()] })
              }
            >
              <PlusIcon /> Alternativa
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Com imagem, o texto da alternativa aparece embaixo dela e serve de descrição para leitores de tela.
          </p>
          {locked ? (
            <p className="text-xs text-muted-foreground">
              Já existem respostas: você pode corrigir o texto, mas não adicionar, remover ou trocar a correta.
            </p>
          ) : null}
        </div>
      ) : null}

      {draft.type === "quiz" ? (
        <div className="flex flex-wrap items-end gap-4">
          <Field className="w-full max-w-xs">
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
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={draft.settings.speedBonus && draft.settings.timerSeconds !== null}
              disabled={draft.settings.timerSeconds === null || locked}
              onChange={(e) => setSettings({ speedBonus: e.target.checked })}
              className="size-4"
            />
            Bônus de velocidade
          </label>
          <p className="w-full text-xs text-muted-foreground">
            {draft.settings.timerSeconds === null
              ? "O bônus de velocidade precisa de tempo para responder."
              : "Com bônus, quem acerta na hora leva os pontos cheios; no fim do tempo, a metade."}
          </p>
        </div>
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

      <div className="flex flex-wrap gap-2">
        {formActions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant ?? "default"}
            onClick={() => save(action)}
            disabled={pending || action.disabled || uploads > 0}
          >
            {pending && running === action.label ? action.pendingLabel : action.label}
          </Button>
        ))}
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
