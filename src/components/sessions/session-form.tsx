"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  createSessionAction,
  updateSessionAction,
  type SessionFormState,
} from "@/features/sessions/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
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

  return (
    <form action={formAction} className="grid gap-5">
      <Field>
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaults.title}
          placeholder="Como a IA está mudando o mercado de trabalho"
          maxLength={200}
          required
        />
      </Field>
      <Field>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaults.description}
          placeholder="Do que trata a sessão e para quem ela é."
          maxLength={2000}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field>
          <Label htmlFor="date">Data</Label>
          <Input id="date" name="date" type="date" defaultValue={defaults.date} />
        </Field>
        <Field>
          <Label htmlFor="time">Horário</Label>
          <Input id="time" name="time" type="time" defaultValue={defaults.time} />
        </Field>
        <Field>
          <Label htmlFor="duration">Duração (min)</Label>
          <Input id="duration" name="duration" type="number" min={1} max={1440} defaultValue={defaults.duration} />
        </Field>
      </div>
      <Field>
        <Label htmlFor="locale">Idioma da sessão</Label>
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
        <p className="text-xs text-muted-foreground">
          O telão e o celular da plateia aparecem neste idioma, assim como o filtro de palavrões e as sugestões da IA.
        </p>
      </Field>
      <Field>
        <Label htmlFor="joinCode">Código de entrada (opcional)</Label>
        <Input
          id="joinCode"
          name="joinCode"
          defaultValue={defaults.joinCode}
          placeholder="Ex.: IA2026 — deixe vazio para gerar automaticamente"
          maxLength={10}
          disabled={!canEditCode}
          className="uppercase"
        />
        {!canEditCode ? (
          <p className="text-xs text-muted-foreground">O código não pode mudar depois que a sessão começou.</p>
        ) : null}
      </Field>
      <Field>
        <Label htmlFor="surveyTemplateId">Pesquisa pós-evento</Label>
        {lockedSurveyName ? (
          <>
            <Input id="surveyTemplateId" value={lockedSurveyName} disabled readOnly />
            <input type="hidden" name="surveyTemplateId" value={defaults.surveyTemplateId} />
            <p className="text-xs text-muted-foreground">A sessão já foi encerrada com esta pesquisa.</p>
          </>
        ) : (
          <>
            <Select
              id="surveyTemplateId"
              name="surveyTemplateId"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <optgroup label="Modelos prontos">
                {platform.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
              {surveyOptions.some((o) => !o.isPlatform) ? (
                <optgroup label="Meus modelos">
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
              A plateia responde ao encerrar a sessão.{" "}
              <Link href="/dashboard/pesquisas" className="text-primary underline-offset-4 hover:underline">
                Ver ou criar modelos
              </Link>
            </p>
          </>
        )}
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : sessionId ? "Salvar informações" : "Criar sessão"}
        </Button>
      </div>
    </form>
  );
}
