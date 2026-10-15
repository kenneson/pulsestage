"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { joinSessionAction, type JoinFormState } from "@/features/participant/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { AVATARS } from "@/lib/domain/gamification";
import { localizedPath } from "@/lib/domain/locale";

const initial: JoinFormState = {};

export function JoinForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(joinSessionAction.bind(null, code), initial);
  const t = useTranslations("participant.joinForm");
  const tDomain = useTranslations("domain");
  // A política abre no idioma da sessão, o mesmo destes botões.
  const privacyHref = localizedPath(useLocale(), "/privacidade");
  const privacyLink = (chunks: React.ReactNode) => (
    <Link href={privacyHref} target="_blank" className="underline hover:text-foreground">
      {chunks}
    </Link>
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field>
        <Label htmlFor="name">{t("nameLabel")}</Label>
        <Input id="name" name="name" maxLength={60} autoComplete="given-name" placeholder={t("namePlaceholder")} />
        <p className="text-xs text-muted-foreground">{t("nameHint")}</p>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("avatarLegend")}</legend>
        <div className="grid grid-cols-6 gap-2">
          {AVATARS.map((avatar) => (
            <label key={avatar.key} title={tDomain(`avatars.${avatar.key}`)} className="cursor-pointer">
              <input type="radio" name="avatar" value={avatar.key} className="peer sr-only" aria-label={tDomain(`avatars.${avatar.key}`)} />
              <span
                aria-hidden
                className="grid aspect-square place-items-center rounded-xl border-2 border-border text-3xl leading-none transition-[transform,border-color] peer-checked:scale-110 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:border-primary/40"
              >
                {avatar.emoji}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("avatarHint")}</p>
      </fieldset>

      <details className="rounded-lg border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">{t("materialSummary")}</summary>
        <div className="mt-3 flex flex-col gap-3">
          <Field>
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} />
          </Field>
          <Field>
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={32} />
          </Field>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" name="consent" className="mt-0.5 size-4" />
            <span>{t.rich("consent", { link: privacyLink })}</span>
          </label>
        </div>
      </details>

      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t.rich("terms", { link: privacyLink })}</p>
    </form>
  );
}
