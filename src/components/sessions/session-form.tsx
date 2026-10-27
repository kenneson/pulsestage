"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createSessionAction,
  updateSessionAction,
  type SessionFormState,
} from "@/features/sessions/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { ChevronRightIcon } from "@/components/icons";
import { StepFooter } from "@/components/sessions/session-stepper";
import { LOCALE_NAME, LOCALES, isLocale, type Locale } from "@/lib/domain/locale";

type Defaults = {
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  joinCode: string;
  surveyTemplateId: string;
  locale: Locale;
  pace: SessionPace;
  useBrand: boolean;
};

export type SessionPace = "live" | "self";
const PACES: readonly SessionPace[] = ["live", "self"];

export type SurveyOption = { id: string; name: string; isPlatform: boolean; locale: string; slug: string | null };

const EMPTY: Defaults = {
  title: "",
  description: "",
  date: "",
  time: "",
  duration: "60",
  joinCode: "",
  surveyTemplateId: "",
  locale: "pt-BR",
  pace: "live",
  useBrand: true,
};
const initial: SessionFormState = {};

export function SessionForm({
  sessionId,
  defaults = EMPTY,
  canEditCode = true,
  surveyOptions,
  hasBrand = false,
  stepSubmitLabel,
}: {
  sessionId?: string;
  defaults?: Defaults;
  canEditCode?: boolean;
  surveyOptions: SurveyOption[];
  /** O palestrante já tem logo ou cor: aparece "Usar minha marca". */
  hasBrand?: boolean;
  /** Nova sessão em passos: o envio vira "Próximo" na barra de passos (StepFooter), com este rótulo. */
  stepSubmitLabel?: string;
}) {
  const t = useTranslations("session.form");
  const tActions = useTranslations("common.actions");
  const action = sessionId ? updateSessionAction.bind(null, sessionId) : createSessionAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const [locale, setLocale] = useState<Locale>(defaults.locale);
  const [templateId, setTemplateId] = useState(defaults.surveyTemplateId);
  const [pace, setPace] = useState<SessionPace>(defaults.pace);

  function changeLocale(next: Locale) {
    setLocale(next);
    // Modelo pronto escolhido: troca pelo mesmo modelo no novo idioma.
    const current = surveyOptions.find((o) => o.id === templateId);
    if (current?.isPlatform) {
      const same = surveyOptions.find((o) => o.isPlatform && o.locale === next && o.slug === current.slug);
      if (same) setTemplateId(same.id);
    }
  }

  // Só o título é obrigatório: na criação, o resto fica em "Mais opções" (recolhido). Campos dentro de
  // um <details> fechado continuam no formulário e são enviados com os valores padrão.
  const advanced = (
    <div className="grid gap-5">
      <Field>
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaults.description}
          placeholder={t("descriptionPlaceholder")}
          maxLength={2000}
        />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium leading-none">{t("pace")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PACES.map((value) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name="pace"
                value={value}
                checked={pace === value}
                onChange={() => setPace(value)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--primary)] max-md:size-5"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">{value === "live" ? t("paceLive") : t("paceSelf")}</span>
                <span className="text-xs text-muted-foreground">{value === "live" ? t("paceLiveHint") : t("paceSelfHint")}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {hasBrand ? (
        <label className="flex cursor-pointer items-start gap-2.5 text-sm max-md:min-h-11">
          <input type="hidden" name="useBrandShown" value="1" />
          <input
            type="checkbox"
            name="useBrand"
            defaultChecked={defaults.useBrand}
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)] max-md:size-5"
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{t("useBrand")}</span>
            <span className="text-xs text-muted-foreground">{t("useBrandHint")}</span>
          </span>
        </label>
      ) : null}
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field>
          <Label htmlFor="duration">{t("duration")}</Label>
          <Input id="duration" name="duration" type="number" min={1} max={1440} defaultValue={defaults.duration} />
        </Field>
        <Field>
          <Label htmlFor="locale">{t("locale")}</Label>
          <Select
            id="locale"
            name="locale"
            value={locale}
            onChange={(e) => isLocale(e.target.value) && changeLocale(e.target.value)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_NAME[l]}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{t("localeHelp")}</p>
        </Field>
      </div>
      <Field>
        <Label htmlFor="joinCode">{t("joinCode")}</Label>
        <Input
          id="joinCode"
          name="joinCode"
          defaultValue={defaults.joinCode}
          placeholder={t("joinCodePlaceholder")}
          maxLength={10}
          disabled={!canEditCode}
          className="uppercase"
        />
        {!canEditCode ? (
          <p className="text-xs text-muted-foreground">{t("joinCodeLocked")}</p>
        ) : null}
      </Field>
    </div>
  );

  return (
    <form id="session-form" action={formAction} className="grid gap-5">
      {/* Na criação, o modelo padrão segue o idioma escolhido; depois, o passo "Pesquisa pós-evento" troca. */}
      {!sessionId && templateId ? <input type="hidden" name="surveyTemplateId" value={templateId} /> : null}
      <Field>
        <Label htmlFor="title">
          {t("title")} <span className="font-normal text-muted-foreground">({t("required")})</span>
        </Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaults.title}
          placeholder={t("titlePlaceholder")}
          maxLength={200}
          required
          aria-describedby={sessionId ? undefined : "title-hint"}
        />
        {!sessionId ? (
          <p id="title-hint" className="text-xs text-muted-foreground">
            {t("requiredHint")}
          </p>
        ) : null}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <Label htmlFor="date">{t("date")}</Label>
          <Input id="date" name="date" type="date" defaultValue={defaults.date} />
        </Field>
        <Field>
          <Label htmlFor="time">{t("time")}</Label>
          <Input id="time" name="time" type="time" defaultValue={defaults.time} />
        </Field>
      </div>
      {sessionId ? (
        advanced
      ) : (
        <details className="group rounded-lg border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon aria-hidden className="shrink-0 transition-transform group-open:rotate-90" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{t("moreOptions")}</span>
              <span className="text-xs text-muted-foreground">{t("moreOptionsHint")}</span>
            </span>
          </summary>
          <div className="border-t p-4">{advanced}</div>
        </details>
      )}
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {stepSubmitLabel ? (
        <StepFooter back={null}>
          <Button type="submit" disabled={pending} className="max-md:min-w-0 max-md:px-3">
            <span className="truncate">{pending ? tActions("saving") : stepSubmitLabel}</span> <ChevronRightIcon />
          </Button>
        </StepFooter>
      ) : (
        <div>
          <Button type="submit" disabled={pending} className="max-md:h-11 max-md:w-full">
            {pending ? tActions("saving") : sessionId ? t("saveInfo") : t("create")}
          </Button>
        </div>
      )}
    </form>
  );
}
