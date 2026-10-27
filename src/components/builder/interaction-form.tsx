"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveInteractionAction } from "@/features/interactions/actions";
import {
  defaultOption,
  hasOptions,
  hasOptionStyle,
  interactionInputSchema,
  type InteractionInput,
  type InteractionType,
  type NormalizedSettings,
} from "@/lib/domain/interactions";
import { OPTION_STYLES, type OptionStyle } from "@/lib/domain/gamification";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { ShapeGlyph, shapeText } from "@/components/option-shape";
import type { ActionResult } from "@/lib/action-result";
import { translateMessage } from "@/i18n/errors";
import { draftToInput, type EditableOption, type InteractionDraft } from "./draft";
import { OptionImagePicker } from "./image-upload";
import {
  CommonSettings,
  ContentSettings,
  GuessNumberSettings,
  MatrixSettings,
  NotesField,
  PinImageSettings,
  PollSettings,
  QuizTextSettings,
  SpeedBonusField,
  TimerField,
  type EditorContext,
} from "./type-editors";

export { emptyDraft, type EditableOption, type InteractionDraft } from "./draft";

const newOption = (isCorrect = false): EditableOption => defaultOption(isCorrect);

/** Alternativas com imagem opcional (no estilo grade de imagens, obrigatória). */
const TAKES_OPTION_IMAGES: readonly InteractionType[] = ["multiple_choice", "quiz", "ranking"];

/** Exemplo no campo do título, por tipo (os outros usam o exemplo geral). */
const TITLE_PLACEHOLDER = {
  points_100: "titlePlaceholderPoints",
  matrix_2x2: "titlePlaceholderMatrix",
  pin_image: "titlePlaceholderPin",
  guess_number: "titlePlaceholderGuess",
  quiz_text: "titlePlaceholderQuizText",
  content: "titlePlaceholderContent",
} as const satisfies Partial<Record<InteractionType, string>>;

/** Botão de salvar alternativo (ex.: sala ao vivo: "Lançar agora" e "Deixar como próxima"). */
export type InteractionFormAction = {
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline";
  disabled?: boolean;
  submit: (input: InteractionInput) => Promise<ActionResult<{ id: string }>>;
};

function isOptionStyle(value: string): value is OptionStyle {
  return (OPTION_STYLES as readonly string[]).includes(value);
}

export function InteractionForm({
  sessionId,
  initial,
  locked = false,
  onDone,
  onCancel,
  actions,
  embedded = false,
}: {
  sessionId: string;
  initial: InteractionDraft;
  /** Já existem respostas: estrutura das alternativas não pode mudar. */
  locked?: boolean;
  onDone: () => void;
  onCancel: () => void;
  /** Sem `actions`, há um único "Salvar" que cria ou edita pelo roteiro. */
  actions?: InteractionFormAction[];
  /** Dentro de um diálogo/folha que já tem fundo e borda: no celular, o formulário fica sem card próprio. */
  embedded?: boolean;
}) {
  const t = useTranslations("builder.form");
  const tCommon = useTranslations("common.actions");
  const tDomain = useTranslations("domain");
  const tErrors = useTranslations("errors");
  const [draft, setDraft] = useState<InteractionDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Mexeu no formulário: o aviso do último "Salvar" sai (ex.: a imagem que faltava já foi enviada).
  const update = (patch: Partial<InteractionDraft>) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const setSettings = (patch: Partial<NormalizedSettings>) => {
    setError(null);
    setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  };

  const setOption = (index: number, patch: Partial<EditableOption>) =>
    setDraft((d) => ({
      ...d,
      options: d.options.map((o, i) =>
        i === index ? { ...o, ...patch } : patch.isCorrect && d.type === "quiz" ? { ...o, isCorrect: false } : o,
      ),
    }));

  // Sem alternativas suficientes, o limite de escolhas da enquete acompanha.
  const removeOption = (index: number) =>
    setDraft((d) => {
      const options = d.options.filter((_, i) => i !== index);
      const maxChoices = d.settings.maxChoices > 1 ? Math.max(Math.min(d.settings.maxChoices, options.length), 1) : 1;
      return { ...d, options, settings: { ...d.settings, maxChoices } };
    });

  const defaultAction: InteractionFormAction = {
    label: tCommon("save"),
    pendingLabel: tCommon("saving"),
    submit: (input) => saveInteractionAction(sessionId, draft.id, input),
  };
  const formActions = actions ?? [defaultAction];
  const [running, setRunning] = useState<string | null>(null);
  // Imagens subindo: salvar agora perderia a imagem.
  const [uploads, setUploads] = useState(0);
  const onBusy = (busy: boolean) => setUploads((n) => n + (busy ? 1 : -1));
  const ctx: EditorContext = { draft, update, setSettings, locked, onBusy };

  /** Erros que o schema daria com uma mensagem genérica: avisos próprios do formulário. */
  function localError(): string | null {
    if (draft.type === "pin_image" && !draft.settings.imagePath) return t("pinImageRequired");
    if (draft.type === "guess_number" && draft.answerValue === null) return t("guessAnswerRequired");
    return null;
  }

  function save(action: InteractionFormAction) {
    const local = localError();
    if (local) {
      setError(local);
      return;
    }
    const input = draftToInput(draft);
    const check = interactionInputSchema.safeParse(input);
    if (!check.success) {
      const issue = check.error.issues[0];
      setError(issue ? translateMessage(tErrors, issue.message) : t("reviewFields"));
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
      if (!actions) toast.success(draft.id ? t("updated") : t("created"));
      onDone();
    });
  }

  const { type, settings } = draft;
  const isContent = type === "content";
  const titlePlaceholder = type in TITLE_PLACEHOLDER ? TITLE_PLACEHOLDER[type as keyof typeof TITLE_PLACEHOLDER] : "questionPlaceholder";
  const minOptions = type === "matrix_2x2" ? 1 : 2;
  const maxOptions = type === "quiz" ? 6 : 8;
  const optionImages = TAKES_OPTION_IMAGES.includes(type);
  const isMatrix = type === "matrix_2x2";
  // Grade de imagens só na enquete (um quiz antigo nesse estilo continua com a opção para não perdê-la).
  const styles = OPTION_STYLES.filter((style) => style !== "images" || type === "multiple_choice" || settings.optionStyle === "images");

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-background p-4",
        embedded && "max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:p-0",
      )}
    >
      <p className="text-sm font-medium text-primary">{tDomain(`interactionTypes.${type}.label`)}</p>

      <Field>
        <Label htmlFor="interaction-title">{isContent ? t("contentTitle") : t("question")}</Label>
        <Input
          id="interaction-title"
          value={draft.title}
          onChange={(e) => update({ title: e.target.value })}
          maxLength={300}
          placeholder={t(titlePlaceholder)}
          autoFocus
        />
      </Field>

      {!isContent ? (
        <Field>
          <Label htmlFor="interaction-description">{t("description")}</Label>
          <Textarea
            id="interaction-description"
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            maxLength={1000}
            className="min-h-14"
          />
        </Field>
      ) : null}

      {type === "pin_image" ? <PinImageSettings ctx={ctx} /> : null}

      {hasOptionStyle(type) ? (
        <Field className="max-w-xs">
          <Label htmlFor="option-style">{t("optionStyle")}</Label>
          <Select
            id="option-style"
            value={settings.optionStyle}
            onChange={(e) => isOptionStyle(e.target.value) && setSettings({ optionStyle: e.target.value })}
          >
            {styles.map((style) => (
              <option key={style} value={style}>
                {style === "text" ? t("optionStyleText") : style === "shapes" ? t("optionStyleShapes") : t("optionStyleImages")}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {hasOptions(type) ? (
        <div className="flex flex-col gap-2">
          <Label>
            {type === "quiz"
              ? t("optionsQuiz")
              : type === "ranking"
                ? t("optionsRanking")
                : type === "points_100"
                  ? t("optionsPoints")
                  : isMatrix
                    ? t("optionsMatrix")
                    : t("options")}
          </Label>
          {draft.options.map((option, index) => {
            const name = isMatrix ? t("item", { number: index + 1 }) : t("option", { number: index + 1 });
            return (
              // No celular, no quiz, imagem, pontos e excluir vão para a linha de baixo (o texto fica com a largura toda).
              <div key={option.id ?? `new-${index}`} className="flex items-center gap-2 max-md:flex-wrap max-md:gap-y-1">
                {settings.optionStyle === "shapes" ? <ShapeGlyph index={index} className={shapeText(index)} /> : null}
                {type === "quiz" ? (
                  // O <label> só existe para dar 44px de toque no celular; no computador é `contents`.
                  <label className="md:contents max-md:-mx-1.5 max-md:grid max-md:size-11 max-md:shrink-0 max-md:cursor-pointer max-md:place-items-center">
                    <input
                      type="radio"
                      name="correct-option"
                      aria-label={t("isCorrect", { number: index + 1 })}
                      checked={option.isCorrect}
                      onChange={() => setOption(index, { isCorrect: true })}
                      disabled={locked}
                      className="size-4 accent-[var(--primary)] max-md:size-5"
                    />
                  </label>
                ) : null}
                <Input
                  value={option.label}
                  onChange={(e) => setOption(index, { label: e.target.value })}
                  placeholder={option.imagePath ? t("describeImage") : name}
                  aria-label={name}
                  maxLength={200}
                  className="max-md:h-11 max-md:flex-1 max-md:basis-0"
                />
                <div
                  className={cn(
                    "md:contents max-md:flex max-md:items-center max-md:gap-1",
                    type === "quiz" && "max-md:w-full max-md:justify-end",
                  )}
                >
                  {optionImages ? (
                    <OptionImagePicker
                      path={option.imagePath}
                      index={index}
                      onChange={(imagePath) => setOption(index, { imagePath })}
                      onBusy={onBusy}
                    />
                  ) : null}
                  {type === "quiz" ? (
                    <span aria-hidden className="mr-1 text-xs text-muted-foreground md:hidden">
                      {t("points")}
                    </span>
                  ) : null}
                  {type === "quiz" ? (
                    <Input
                      type="number"
                      aria-label={t("points")}
                      title={t("pointsHint")}
                      value={option.points}
                      min={0}
                      max={10000}
                      onChange={(e) => setOption(index, { points: Number(e.target.value) || 0 })}
                      className="w-24 max-md:h-11"
                      disabled={locked}
                    />
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="max-md:size-11"
                    aria-label={isMatrix ? t("removeItem") : t("removeOption")}
                    disabled={locked || draft.options.length <= minOptions}
                    onClick={() => removeOption(index)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </div>
            );
          })}
          <div>
            <Button
              variant="outline"
              size="sm"
              className="max-md:h-11 max-md:w-full max-md:text-sm"
              disabled={locked || draft.options.length >= maxOptions}
              onClick={() => update({ options: [...draft.options, newOption()] })}
            >
              <PlusIcon /> {isMatrix ? t("addItem") : t("addOption")}
            </Button>
          </div>
          {optionImages ? (
            <p className="text-xs text-muted-foreground">
              {settings.optionStyle === "images" ? t("imagesStyleHint") : t("imageHint")}
            </p>
          ) : null}
          {type === "points_100" ? <p className="text-xs text-muted-foreground">{t("pointsBudgetHint")}</p> : null}
          {locked ? <p className="text-xs text-muted-foreground">{t("lockedHint")}</p> : null}
        </div>
      ) : null}

      {isMatrix ? <MatrixSettings ctx={ctx} /> : null}
      {type === "multiple_choice" ? <PollSettings ctx={ctx} /> : null}

      {type === "quiz" ? (
        <div className="flex flex-col gap-3">
          <TimerField ctx={ctx} id="quiz-timer" />
          <SpeedBonusField ctx={ctx} />
        </div>
      ) : null}

      {type === "rating" ? (
        <div className="grid gap-4 sm:grid-cols-2 max-sm:grid-cols-2 max-sm:items-end max-sm:gap-3">
          <Field>
            <Label htmlFor="rating-min">{t("min")}</Label>
            <Select id="rating-min" value={settings.min} onChange={(e) => setSettings({ min: Number(e.target.value) })}>
              <option value={0}>0</option>
              <option value={1}>1</option>
            </Select>
          </Field>
          <Field>
            <Label htmlFor="rating-max">{t("max")}</Label>
            <Select id="rating-max" value={settings.max} onChange={(e) => setSettings({ max: Number(e.target.value) })}>
              {[3, 4, 5, 7, 10].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="rating-min-label">{t("minLabel")}</Label>
            <Input
              id="rating-min-label"
              value={settings.minLabel ?? ""}
              onChange={(e) => setSettings({ minLabel: e.target.value || null })}
              placeholder={t("minLabelPlaceholder")}
              maxLength={40}
            />
          </Field>
          <Field>
            <Label htmlFor="rating-max-label">{t("maxLabel")}</Label>
            <Input
              id="rating-max-label"
              value={settings.maxLabel ?? ""}
              onChange={(e) => setSettings({ maxLabel: e.target.value || null })}
              placeholder={t("maxLabelPlaceholder")}
              maxLength={40}
            />
          </Field>
        </div>
      ) : null}

      {type === "word_cloud" || type === "open_text" ? (
        <div className="flex flex-wrap items-end gap-4">
          <Field className="w-40">
            <Label htmlFor="max-length">{t("maxLength")}</Label>
            <Input
              id="max-length"
              type="number"
              min={type === "word_cloud" ? 5 : 20}
              max={type === "word_cloud" ? 50 : 500}
              value={settings.maxLength}
              onChange={(e) => setSettings({ maxLength: Number(e.target.value) || 0 })}
            />
          </Field>
          {type === "open_text" ? (
            <label className="flex items-center gap-2 pb-2 text-sm max-md:min-h-11 max-md:pb-0">
              <input
                type="checkbox"
                checked={settings.showOnDisplay}
                onChange={(e) => setSettings({ showOnDisplay: e.target.checked })}
                className="size-4"
              />
              {t("showOnDisplay")}
            </label>
          ) : null}
        </div>
      ) : null}

      {type === "guess_number" ? <GuessNumberSettings ctx={ctx} /> : null}
      {type === "quiz_text" ? <QuizTextSettings ctx={ctx} /> : null}
      {isContent ? <ContentSettings ctx={ctx} /> : null}

      <div className="flex flex-col gap-2">
        <CommonSettings ctx={ctx} />
        <NotesField ctx={ctx} />
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {/* No celular: botões de 44px em duas colunas; com duas ações, "Cancelar" ocupa a linha de baixo. */}
      <div className="flex flex-wrap gap-2 max-md:grid max-md:grid-cols-2">
        {formActions.map((action) => (
          <Button
            key={action.label}
            className="max-md:h-auto max-md:min-h-11 max-md:whitespace-normal"
            variant={action.variant ?? "default"}
            onClick={() => save(action)}
            disabled={pending || action.disabled || uploads > 0}
          >
            {pending && running === action.label ? action.pendingLabel : action.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
          className={cn("max-md:h-11", formActions.length % 2 === 0 && "max-md:col-span-2")}
        >
          {tCommon("cancel")}
        </Button>
      </div>
    </div>
  );
}
