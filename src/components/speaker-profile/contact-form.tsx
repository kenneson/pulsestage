"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { sendContactRequestAction, type ContactFormState } from "@/features/speaker-profile/actions";
import { ORG_KINDS } from "@/lib/domain/speaker-profile";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { CheckIcon, SendIcon } from "@/components/icons";

const initial: ContactFormState = {};

/** "Convidar para palestrar": o pedido vai para a caixa do palestrante; o e-mail dele não aparece. */
/** `privacyHref`: link da política de privacidade já no idioma da página (prefixo /es, /en). */
export function ContactForm({ slug, speakerName, privacyHref }: { slug: string; speakerName: string; privacyHref: string }) {
  const t = useTranslations("profile.contact");
  const tDomain = useTranslations("domain");
  const tCommon = useTranslations("common.actions");
  const [state, action, pending] = useActionState(sendContactRequestAction.bind(null, slug), initial);
  const v = state.values ?? {};

  if (state.sent) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-6 text-center" role="status">
        <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon width={20} height={20} />
        </span>
        <p className="font-semibold">{t("sentTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("sentBody", { name: speakerName })}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="c-name">{t("name")}</Label>
          <Input id="c-name" name="name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={v.name} />
        </Field>
        <Field>
          <Label htmlFor="c-email">{t("email")}</Label>
          <Input id="c-email" name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={v.email} />
        </Field>
        <Field>
          <Label htmlFor="c-org">{t("organization")}</Label>
          <Input id="c-org" name="organization" maxLength={160} autoComplete="organization" defaultValue={v.organization} />
        </Field>
        <Field>
          <Label htmlFor="c-kind">{t("kind")}</Label>
          <Select id="c-kind" name="orgKind" defaultValue={v.orgKind ?? ""}>
            <option value="">—</option>
            {ORG_KINDS.map((k) => (
              <option key={k} value={k}>
                {tDomain(`orgKinds.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="c-date">{t("date")}</Label>
          <Input id="c-date" name="eventDate" type="date" defaultValue={v.eventDate} />
        </Field>
        <Field>
          <Label htmlFor="c-city">{t("city")}</Label>
          <Input id="c-city" name="eventCity" maxLength={80} defaultValue={v.eventCity} />
        </Field>
      </div>
      <Field>
        <Label htmlFor="c-message">{t("message")}</Label>
        <Textarea
          id="c-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          defaultValue={v.message}
          placeholder={t("messagePlaceholder")}
        />
      </Field>
      {/* Armadilha para robôs: invisível para pessoas e leitores de tela. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="c-website">{t("trap")}</label>
        <input id="c-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          <SendIcon /> {pending ? tCommon("sending") : t("submit")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t.rich("privacyNote", {
            name: speakerName,
            link: (c) => (
              <Link href={`${privacyHref}#convites`} className="underline hover:text-foreground">
                {c}
              </Link>
            ),
          })}
        </p>
      </div>
    </form>
  );
}
