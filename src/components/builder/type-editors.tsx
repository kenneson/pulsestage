"use client";

import { useTranslations } from "next-intl";
import {
  ACCEPTED_ANSWERS_MAX,
  CONTENT_BODY_MAX,
  isScoredType,
  NOTES_MAX,
  supportsTimer,
  type NormalizedSettings,
} from "@/lib/domain/interactions";
import { toEmbedUrl } from "@/lib/domain/content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { FileTextIcon, PlusIcon, SettingsIcon, TrashIcon } from "@/components/icons";
import type { InteractionDraft } from "./draft";
import { CheckboxRow, Collapsible, NumberInput } from "./fields";
import { ImageField } from "./image-upload";
import { VideoEmbed } from "./content-preview";

export type EditorContext = {
  draft: InteractionDraft;
  update: (patch: Partial<InteractionDraft>) => void;
  setSettings: (patch: Partial<NormalizedSettings>) => void;
  /** já existem respostas: alternativas e acerto travados */
  locked: boolean;
  onBusy: (busy: boolean) => void;
};

const TIMER_CHOICES = [10, 15, 20, 30, 45, 60, 90, 120, 180, 300];

/** Tempo para responder (vale para todo tipo que recebe resposta). */
export function TimerField({ ctx, id = "interaction-timer" }: { ctx: EditorContext; id?: string }) {
  const t = useTranslations("builder.form");
  const value = ctx.draft.settings.timerSeconds;
  const choices = value !== null && !TIMER_CHOICES.includes(value) ? [...TIMER_CHOICES, value].sort((a, b) => a - b) : TIMER_CHOICES;
  return (
    <Field className="w-full max-w-xs">
      <Label htmlFor={id}>{t("timer")}</Label>
      <Select id={id} value={value ?? 0} onChange={(e) => ctx.setSettings({ timerSeconds: Number(e.target.value) || null })}>
        <option value={0}>{t("noLimit")}</option>
        {choices.map((s) => (
          <option key={s} value={s}>
            {t("timerSeconds", { seconds: s })}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Bônus de velocidade (quiz e quiz de digitar): só com tempo para responder. */
export function SpeedBonusField({ ctx }: { ctx: EditorContext }) {
  const t = useTranslations("builder.form");
  const { settings } = ctx.draft;
  return (
    <CheckboxRow
      checked={settings.speedBonus && settings.timerSeconds !== null}
      disabled={settings.timerSeconds === null}
      onChange={(speedBonus) => ctx.setSettings({ speedBonus })}
      label={t("speedBonus")}
      hint={settings.timerSeconds === null ? t("speedBonusNeedsTimer") : t("speedBonusHint")}
    />
  );
}

/** Enquete: grade de imagens, várias escolhas com limite e "comparar grupos". */
export function PollSettings({ ctx }: { ctx: EditorContext }) {
  const t = useTranslations("builder.poll");
  const { settings, options } = ctx.draft;
  const multiple = settings.maxChoices > 1;
  const limit = Math.max(2, options.length);
  return (
    <div className="flex flex-col gap-3">
      <CheckboxRow
        checked={multiple}
        disabled={options.length < 2}
        onChange={(on) => ctx.setSettings({ maxChoices: on ? Math.min(2, limit) : 1 })}
        label={t("multiple")}
        hint={t("multipleHint")}
      />
      {multiple ? (
        <Field className="max-w-xs pl-7 max-md:pl-8">
          <Label htmlFor="poll-max-choices">{t("maxChoices")}</Label>
          <Select
            id="poll-max-choices"
            value={Math.min(settings.maxChoices, limit)}
            onChange={(e) => ctx.setSettings({ maxChoices: Number(e.target.value) })}
          >
            {Array.from({ length: limit - 1 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n === options.length ? t("maxChoicesAll", { count: n }) : t("maxChoicesValue", { count: n })}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <CheckboxRow
        checked={settings.isSegment}
        onChange={(isSegment) => ctx.setSettings({ isSegment })}
        label={t("segment")}
        hint={t("segmentHint")}
      />
    </div>
  );
}

type MatrixKey = "xLabel" | "yLabel" | "xLow" | "xHigh" | "yLow" | "yHigh";

/** Prévia pequena da matriz: eixos, pontas e quantos itens serão posicionados. */
function MatrixPreview({ settings, items }: { settings: NormalizedSettings; items: number }) {
  const t = useTranslations("builder.matrix");
  return (
    <figure className="flex w-full max-w-60 flex-col gap-1" aria-label={t("preview")}>
      <figcaption className="text-xs font-medium text-muted-foreground">{t("preview")}</figcaption>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1.5">
        <span className="flex items-center justify-center text-[11px] font-medium text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          {settings.yLabel || t("yNamePlaceholder")}
        </span>
        <div className="relative aspect-square w-full rounded-md border bg-muted/40">
          <span aria-hidden className="absolute inset-x-0 top-1/2 border-t border-dashed" />
          <span aria-hidden className="absolute inset-y-0 left-1/2 border-l border-dashed" />
          <span className="absolute left-1.5 top-1 text-[10px] text-muted-foreground">{settings.yHigh || t("highPlaceholder")}</span>
          <span className="absolute bottom-1 left-1.5 text-[10px] text-muted-foreground">{settings.yLow || t("lowPlaceholder")}</span>
          {Array.from({ length: Math.min(items, 8) }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="absolute size-2.5 rounded-full bg-primary/70"
              style={{ left: `${18 + ((i * 37) % 62)}%`, top: `${18 + ((i * 53) % 62)}%` }}
            />
          ))}
        </div>
        <span />
        <div className="mt-1 flex justify-between gap-1 text-[10px] text-muted-foreground">
          <span>{settings.xLow || t("lowPlaceholder")}</span>
          <span className="text-[11px] font-medium">{settings.xLabel || t("xNamePlaceholder")}</span>
          <span>{settings.xHigh || t("highPlaceholder")}</span>
        </div>
      </div>
    </figure>
  );
}

/** Matriz 2×2: nomes dos eixos e rótulos das pontas (os itens ficam na lista de alternativas). */
export function MatrixSettings({ ctx }: { ctx: EditorContext }) {
  const t = useTranslations("builder.matrix");
  const s = ctx.draft.settings;
  const set = (key: MatrixKey, value: string) => {
    const patch: Partial<NormalizedSettings> = {};
    patch[key] = value || null;
    ctx.setSettings(patch);
  };
  const text = (key: MatrixKey, label: string, placeholder: string, small = true) => (
    <Field>
      <Label htmlFor={`matrix-${key}`} className={small ? "text-xs text-muted-foreground" : undefined}>
        {label}
      </Label>
      <Input id={`matrix-${key}`} value={s[key] ?? ""} maxLength={40} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} />
    </Field>
  );
  const axis = (prefix: "x" | "y") => (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{prefix === "x" ? t("xAxis") : t("yAxis")}</legend>
      {text(prefix === "x" ? "xLabel" : "yLabel", t("name"), prefix === "x" ? t("xNamePlaceholder") : t("yNamePlaceholder"))}
      <div className="grid grid-cols-2 gap-2">
        {text(prefix === "x" ? "xLow" : "yLow", prefix === "x" ? t("left") : t("bottom"), t("lowPlaceholder"))}
        {text(prefix === "x" ? "xHigh" : "yHigh", prefix === "x" ? t("right") : t("top"), t("highPlaceholder"))}
      </div>
    </fieldset>
  );
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_13rem] md:items-start">
      {axis("x")}
      {axis("y")}
      <MatrixPreview settings={s} items={ctx.draft.options.length} />
    </div>
  );
}

/** Marcar na imagem: a imagem é obrigatória. */
export function PinImageSettings({ ctx }: { ctx: EditorContext }) {
  const t = useTranslations("builder.pin");
  return (
    <Field>
      <Label htmlFor="pin-image">{t("image")}</Label>
      <ImageField
        id="pin-image"
        required
        path={ctx.draft.settings.imagePath}
        onChange={(imagePath) => ctx.setSettings({ imagePath })}
        onBusy={ctx.onBusy}
      />
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </Field>
  );
}

/** Adivinhe o número: faixa, casas decimais, unidade, resposta certa e pontos. */
export function GuessNumberSettings({ ctx }: { ctx: EditorContext }) {
  const t = useTranslations("builder.guess");
  const tForm = useTranslations("builder.form");
  const s = ctx.draft.settings;
  const step = s.decimals === 0 ? 1 : s.decimals === 1 ? 0.1 : 0.01;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Field>
          <Label htmlFor="guess-min">{t("min")}</Label>
          <NumberInput id="guess-min" value={s.numMin} step={step} onChange={(v) => v !== null && ctx.setSettings({ numMin: v })} />
        </Field>
        <Field>
          <Label htmlFor="guess-max">{t("max")}</Label>
          <NumberInput id="guess-max" value={s.numMax} step={step} onChange={(v) => v !== null && ctx.setSettings({ numMax: v })} />
        </Field>
        <Field>
          <Label htmlFor="guess-decimals">{t("decimals")}</Label>
          <Select id="guess-decimals" value={s.decimals} onChange={(e) => ctx.setSettings({ decimals: Number(e.target.value) })}>
            <option value={0}>{t("decimals0")}</option>
            <option value={1}>{t("decimals1")}</option>
            <option value={2}>{t("decimals2")}</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="guess-unit">{t("unit")}</Label>
          <Input
            id="guess-unit"
            value={s.unit ?? ""}
            maxLength={10}
            placeholder={t("unitPlaceholder")}
            onChange={(e) => ctx.setSettings({ unit: e.target.value || null })}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-start md:gap-4">
        <Field className="md:w-48">
          <Label htmlFor="guess-answer">{t("answer")}</Label>
          <NumberInput
            id="guess-answer"
            value={ctx.draft.answerValue}
            allowEmpty
            step={step}
            min={s.numMin}
            max={s.numMax}
            placeholder={t("answerPlaceholder")}
            onChange={(answerValue) => ctx.update({ answerValue })}
          />
        </Field>
        <Field className="md:w-48">
          <Label htmlFor="guess-points">{t("maxPoints")}</Label>
          <NumberInput
            id="guess-points"
            integer
            value={s.maxPoints}
            min={0}
            max={10000}
            onChange={(v) => v !== null && ctx.setSettings({ maxPoints: Math.round(v) })}
          />
        </Field>
        <p className="col-span-2 text-xs text-muted-foreground md:w-full">
          {t("hint")} {ctx.locked ? tForm("answerKeyLockedHint") : null}
        </p>
      </div>
      <TimerField ctx={ctx} />
    </div>
  );
}

/** Quiz de digitar: respostas aceitas, pontos, tempo e bônus. */
export function QuizTextSettings({ ctx }: { ctx: EditorContext }) {
  const t = useTranslations("builder.quizText");
  const tForm = useTranslations("builder.form");
  const { accepted, settings } = ctx.draft;
  const setAccepted = (next: string[]) => ctx.update({ accepted: next });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>{t("accepted")}</Label>
        {accepted.map((answer, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={answer}
              maxLength={60}
              aria-label={t("answer", { number: index + 1 })}
              placeholder={index === 0 ? t("firstPlaceholder") : t("otherPlaceholder")}
              onChange={(e) => setAccepted(accepted.map((a, i) => (i === index ? e.target.value : a)))}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("remove", { number: index + 1 })}
              disabled={accepted.length <= 1}
              onClick={() => setAccepted(accepted.filter((_, i) => i !== index))}
            >
              <TrashIcon />
            </Button>
          </div>
        ))}
        <div>
          <Button
            variant="outline"
            size="sm"
            className="max-md:h-11 max-md:w-full max-md:text-sm"
            disabled={accepted.length >= ACCEPTED_ANSWERS_MAX}
            onClick={() => setAccepted([...accepted, ""])}
          >
            <PlusIcon /> {t("add")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("hint", { max: ACCEPTED_ANSWERS_MAX })} {ctx.locked ? tForm("answerKeyLockedHint") : null}
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-4 max-md:grid max-md:grid-cols-[7rem_minmax(0,1fr)] max-md:gap-3">
        <Field className="md:w-48">
          <Label htmlFor="quiz-text-points">{t("maxPoints")}</Label>
          <NumberInput
            id="quiz-text-points"
            integer
            value={settings.maxPoints}
            min={0}
            max={10000}
            onChange={(v) => v !== null && ctx.setSettings({ maxPoints: Math.round(v) })}
          />
        </Field>
        <TimerField ctx={ctx} />
      </div>
      <SpeedBonusField ctx={ctx} />
    </div>
  );
}

/** Slide de conteúdo: texto, imagem e vídeo (com prévia do player). */
export function ContentSettings({ ctx }: { ctx: EditorContext }) {
  const t = useTranslations("builder.content");
  const s = ctx.draft.settings;
  const video = s.videoUrl ?? "";
  const videoValid = video.trim() !== "" && toEmbedUrl(video) !== null;
  const videoInvalid = video.trim() !== "" && !videoValid;
  return (
    <div className="flex flex-col gap-4">
      <Field>
        <Label htmlFor="content-body">{t("body")}</Label>
        <Textarea
          id="content-body"
          value={s.body}
          maxLength={CONTENT_BODY_MAX}
          placeholder={t("bodyPlaceholder")}
          className="min-h-32"
          aria-describedby="content-body-hint"
          onChange={(e) => ctx.setSettings({ body: e.target.value })}
        />
        <p id="content-body-hint" className="flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
          <span>{t("bodyHint")}</span>
          <span className="tabular-nums">
            {s.body.length}/{CONTENT_BODY_MAX}
          </span>
        </p>
      </Field>
      <Field>
        <Label htmlFor="content-image">{t("image")}</Label>
        <ImageField id="content-image" path={s.imagePath} onChange={(imagePath) => ctx.setSettings({ imagePath })} onBusy={ctx.onBusy} />
      </Field>
      <Field>
        <Label htmlFor="content-video">{t("video")}</Label>
        <Input
          id="content-video"
          type="url"
          inputMode="url"
          value={video}
          maxLength={300}
          placeholder={t("videoPlaceholder")}
          aria-invalid={videoInvalid || undefined}
          aria-describedby="content-video-hint"
          className={cn(videoInvalid && "border-destructive")}
          onChange={(e) => ctx.setSettings({ videoUrl: e.target.value || null })}
        />
        <p id="content-video-hint" className={cn("text-xs", videoInvalid ? "text-destructive" : "text-muted-foreground")}>
          {videoInvalid ? t("videoInvalid") : t("videoHint")}
        </p>
        {videoValid ? <VideoEmbed url={video} title={t("videoTitle")} className="max-w-md" /> : null}
      </Field>
    </div>
  );
}

/**
 * "Mais ajustes" (todo tipo que recebe resposta): cronômetro (fora dos tipos que pontuam, que mostram o tempo
 * junto dos pontos), esconder resultados e resultado no celular (nunca nos tipos que pontuam).
 */
export function CommonSettings({ ctx }: { ctx: EditorContext }) {
  const t = useTranslations("builder.common");
  const { type, settings } = ctx.draft;
  if (!supportsTimer(type)) return null;
  const scored = isScoredType(type);
  const changed =
    settings.hideResults || (!scored && (settings.timerSeconds !== null || settings.showResultsOnPhone));
  return (
    <Collapsible title={t("title")} hint={scored ? t("hintScored") : t("hint")} defaultOpen={changed} icon={<SettingsIcon aria-hidden className="shrink-0 text-muted-foreground" />}>
      {!scored ? <TimerField ctx={ctx} id="common-timer" /> : null}
      <CheckboxRow
        checked={settings.hideResults}
        onChange={(hideResults) => ctx.setSettings({ hideResults })}
        label={t("hideResults")}
        hint={t("hideResultsHint")}
      />
      {!scored ? (
        <CheckboxRow
          checked={settings.showResultsOnPhone}
          onChange={(showResultsOnPhone) => ctx.setSettings({ showResultsOnPhone })}
          label={t("showOnPhone")}
          hint={t("showOnPhoneHint")}
        />
      ) : null}
    </Collapsible>
  );
}

/** Notas do palestrante: só ele vê, na sala ao vivo, quando o item está no telão. */
export function NotesField({ ctx }: { ctx: EditorContext }) {
  const t = useTranslations("builder.notes");
  return (
    <Collapsible
      title={t("title")}
      hint={t("hint")}
      defaultOpen={ctx.draft.notes.trim() !== ""}
      icon={<FileTextIcon aria-hidden className="shrink-0 text-muted-foreground" />}
    >
      <Textarea
        aria-label={t("title")}
        value={ctx.draft.notes}
        maxLength={NOTES_MAX}
        placeholder={t("placeholder")}
        className="min-h-24"
        onChange={(e) => ctx.update({ notes: e.target.value })}
      />
    </Collapsible>
  );
}
