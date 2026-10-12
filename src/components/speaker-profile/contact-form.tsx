"use client";

import { useActionState } from "react";
import Link from "next/link";
import { sendContactRequestAction, type ContactFormState } from "@/features/speaker-profile/actions";
import { ORG_KIND_LABEL, ORG_KINDS } from "@/lib/domain/speaker-profile";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { CheckIcon, SendIcon } from "@/components/icons";

const initial: ContactFormState = {};

/** "Convidar para palestrar": o pedido vai para a caixa do palestrante; o e-mail dele não aparece. */
export function ContactForm({ slug, speakerName }: { slug: string; speakerName: string }) {
  const [state, action, pending] = useActionState(sendContactRequestAction.bind(null, slug), initial);
  const v = state.values ?? {};

  if (state.sent) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-6 text-center" role="status">
        <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon width={20} height={20} />
        </span>
        <p className="font-semibold">Convite enviado</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {speakerName} recebe o seu pedido e responde pelo e-mail que você informou.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="c-name">Seu nome</Label>
          <Input id="c-name" name="name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={v.name} />
        </Field>
        <Field>
          <Label htmlFor="c-email">Seu e-mail</Label>
          <Input id="c-email" name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={v.email} />
        </Field>
        <Field>
          <Label htmlFor="c-org">Instituição ou empresa</Label>
          <Input id="c-org" name="organization" maxLength={160} autoComplete="organization" defaultValue={v.organization} />
        </Field>
        <Field>
          <Label htmlFor="c-kind">Tipo</Label>
          <Select id="c-kind" name="orgKind" defaultValue={v.orgKind ?? ""}>
            <option value="">—</option>
            {ORG_KINDS.map((k) => (
              <option key={k} value={k}>
                {ORG_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="c-date">Data prevista (opcional)</Label>
          <Input id="c-date" name="eventDate" type="date" defaultValue={v.eventDate} />
        </Field>
        <Field>
          <Label htmlFor="c-city">Cidade (opcional)</Label>
          <Input id="c-city" name="eventCity" maxLength={80} defaultValue={v.eventCity} />
        </Field>
      </div>
      <Field>
        <Label htmlFor="c-message">Mensagem</Label>
        <Textarea
          id="c-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          defaultValue={v.message}
          placeholder="Conte o tema, o público, o formato (presencial ou online) e a duração."
        />
      </Field>
      {/* Armadilha para robôs: invisível para pessoas e leitores de tela. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="c-website">Não preencha</label>
        <input id="c-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          <SendIcon /> {pending ? "Enviando…" : "Enviar convite"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Seus dados vão só para {speakerName}.{" "}
          <Link href="/privacidade#convites" className="underline hover:text-foreground">
            Privacidade
          </Link>
        </p>
      </div>
    </form>
  );
}
