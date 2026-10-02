"use client";

import { useActionState } from "react";
import { joinSessionAction, type JoinFormState } from "@/features/participant/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";

const initial: JoinFormState = {};

export function JoinForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(joinSessionAction.bind(null, code), initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field>
        <Label htmlFor="name">Seu nome (opcional)</Label>
        <Input id="name" name="name" maxLength={60} autoComplete="given-name" placeholder="Pode participar sem nome" />
        <p className="text-xs text-muted-foreground">Aparece só no ranking do quiz. Em branco, você fica anônimo.</p>
      </Field>

      <details className="rounded-lg border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Quero receber o material (opcional)</summary>
        <div className="mt-3 flex flex-col gap-3">
          <Field>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} />
          </Field>
          <Field>
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={32} />
          </Field>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" name="consent" className="mt-0.5 size-4" />
            Autorizo o palestrante a usar meu contato para enviar materiais e comunicações sobre esta sessão. Meu
            contato fica separado das minhas respostas.
          </label>
        </div>
      </details>

      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Entrando…" : "Participar"}
      </Button>
    </form>
  );
}
