"use client";

import { useActionState } from "react";
import Link from "next/link";
import { joinSessionAction, type JoinFormState } from "@/features/participant/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { AVATARS } from "@/lib/domain/gamification";

const initial: JoinFormState = {};

export function JoinForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(joinSessionAction.bind(null, code), initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field>
        <Label htmlFor="name">Seu nome (opcional)</Label>
        <Input id="name" name="name" maxLength={60} autoComplete="given-name" placeholder="Pode participar sem nome" />
        <p className="text-xs text-muted-foreground">Aparece só no ranking do quiz, que pode ser mostrado no telão. Em branco, você fica anônimo.</p>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Escolha um avatar (opcional)</legend>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map((avatar) => (
            <label key={avatar.key} title={avatar.label} className="cursor-pointer">
              <input type="radio" name="avatar" value={avatar.key} className="peer sr-only" aria-label={avatar.label} />
              <span
                aria-hidden
                className="grid aspect-square place-items-center rounded-xl border-2 border-border text-3xl leading-none transition-[transform,border-color] peer-checked:scale-110 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:border-primary/40"
              >
                {avatar.emoji}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Aparece ao lado do seu nome no ranking do quiz.</p>
      </fieldset>

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
            <span>
              Autorizo o palestrante a usar meu contato para enviar materiais e comunicações sobre esta sessão. Meu
              contato fica separado das minhas respostas.{" "}
              <Link href="/privacidade" target="_blank" className="underline hover:text-foreground">
                Política de privacidade
              </Link>
            </span>
          </label>
        </div>
      </details>

      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Entrando…" : "Participar"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Ao participar, você concorda com a{" "}
        <Link href="/privacidade" target="_blank" className="underline hover:text-foreground">
          política de privacidade
        </Link>
        .
      </p>
    </form>
  );
}
