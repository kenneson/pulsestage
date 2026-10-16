"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
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
};

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
};
const initial: SessionFormState = {};

export function SessionForm({
  sessionId,
  defaults = EMPTY,
  canEditCode = true,
  surveyOptions,
  lockedSurveyName,
}: {
  sessionId?: string;
  defaults?: Defaults;
  canEditCode?: boolean;
  surveyOptions: SurveyOption[];
  /** Nome da pesquisa já copiada para a sessão (encerrada): não dá mais para trocar. */
  lockedSurveyName?: string | null;
}) {
  const t = useTranslations("session.form");
  const tActions = useTranslations("common.actions");
  const action = sessionId ? updateSessionAction.bind(null, sessionId) : createSessionAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const [locale, setLocale] = useState<Locale>(defaults.locale);
  const [templateId, setTemplateId] = useState(defaults.surveyTemplateId);
  // Modelos prontos no idioma da sessão (o da plateia); os do speaker aparecem sempre.
  const platform = surveyOptions.filter((o) => o.isPlatform && o.locale === locale);

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
      <Field>
        <Label htmlFor="surveyTemplateId">{t("survey")}</Label>
        {lockedSurveyName ? (
          <>
            <Input id="surveyTemplateId" value={lockedSurveyName} disabled readOnly />
            <input type="hidden" name="surveyTemplateId" value={defaults.surveyTemplateId} />
            <p className="text-xs text-muted-foreground">{t("surveyLocked")}</p>
          </>
        ) : (
          <>
            <Select
              id="surveyTemplateId"
              name="surveyTemplateId"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <optgroup label={t("platformTemplates")}>
                {platform.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
              {surveyOptions.some((o) => !o.isPlatform) ? (
                <optgroup label={t("myTemplates")}>
                  {surveyOptions
                    .filter((o) => !o.isPlatform)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </optgroup>
              ) : null}
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("surveyHelp")}{" "}
              <Link href="/dashboard/pesquisas" className="text-primary underline-offset-4 hover:underline">
                {t("manageTemplates")}
              </Link>
            </p>
          </>
        )}
      </Field>
    </div>
  );

  return (
    <form action={formAction} className="grid gap-5">
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
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? tActions("saving") : sessionId ? t("saveInfo") : t("create")}
        </Button>
      </div>
    </form>
  );
}
