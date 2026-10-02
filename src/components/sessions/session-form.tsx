"use client";

import { useActionState } from "react";
import {
  createSessionAction,
  updateSessionAction,
  type SessionFormState,
} from "@/features/sessions/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";

type Defaults = {
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  joinCode: string;
};

const EMPTY: Defaults = { title: "", description: "", date: "", time: "", duration: "60", joinCode: "" };
const initial: SessionFormState = {};

export function SessionForm({
  sessionId,
  defaults = EMPTY,
  canEditCode = true,
}: {
  sessionId?: string;
  defaults?: Defaults;
  canEditCode?: boolean;
}) {
  const action = sessionId ? updateSessionAction.bind(null, sessionId) : createSessionAction;
  const [state, formAction, pending] = useActionState(action, initial);

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
