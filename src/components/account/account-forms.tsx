"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  changePasswordAction,
  deleteAccountAction,
  removeAvatarAction,
  signOutOthersAction,
  updatePreferencesAction,
  updateProfileAction,
  uploadAvatarAction,
  type AccountFormState,
} from "@/features/account/actions";
import { TIME_ZONE_OPTIONS } from "@/lib/datetime";
import { LOCALE_NAME, LOCALES, type Locale } from "@/lib/domain/locale";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ThemeChoice } from "@/components/theme";
import { CameraIcon, LogOutIcon, TrashIcon } from "@/components/icons";

const initial: AccountFormState = {};

/** Mostra o retorno da action como toast de sucesso ou alerta de erro. */
function useFeedback(state: AccountFormState) {
  useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state]);
  return state.error ? <Alert>{state.error}</Alert> : null;
}

export function AvatarForm({ src, name, email }: { src: string | null; name: string | null; email: string }) {
  const t = useTranslations("account.avatar");
  const tCommon = useTranslations("common.actions");
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadAvatarAction, initial);
  const [removing, startRemoving] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const feedback = useFeedback(state);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-center gap-4 max-md:flex-nowrap">
      <Avatar src={src} name={name} email={email} size={72} />
      <div className="flex flex-col gap-2 max-md:min-w-0">
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            name="avatar"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label={t("choose")}
            onChange={() => formRef.current?.requestSubmit()}
          />
          <Button variant="outline" size="sm" disabled={pending} onClick={() => fileRef.current?.click()} className="max-md:h-11 max-md:text-sm">
            <CameraIcon /> {pending ? tCommon("sending") : t("change")}
          </Button>
          {src ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={removing}
              className="max-md:h-11 max-md:text-sm"
              onClick={() =>
                startRemoving(async () => {
                  const result = await removeAvatarAction();
                  if (!result.ok) toast.error(result.error);
                  else router.refresh();
                })
              }
            >
              {tCommon("remove")}
            </Button>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">{t("hint")}</span>
        {feedback}
      </div>
    </form>
  );
}

export function ProfileForm({ name, email, bio }: { name: string | null; email: string; bio: string | null }) {
  const t = useTranslations("account.profile");
  const tCommon = useTranslations("common.actions");
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  const feedback = useFeedback(state);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" name="name" defaultValue={name ?? ""} maxLength={120} required autoComplete="name" />
        </Field>
        <Field>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" value={email} disabled readOnly />
        </Field>
      </div>
      <Field>
        <Label htmlFor="bio">{t("bio")}</Label>
        <Textarea id="bio" name="bio" defaultValue={bio ?? ""} maxLength={400} placeholder={t("bioPlaceholder")} />
        <p className="text-xs text-muted-foreground">{t("bioHint")}</p>
      </Field>
      {feedback}
      <div>
        <Button type="submit" disabled={pending} className="max-md:h-11 max-md:w-full">
          {pending ? tCommon("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

/** Modelo para o seletor de pesquisa padrão. `locale` null = modelo do próprio speaker. */
export type SurveyOption = { id: string; name: string; locale: Locale | null };

export function PreferencesForm({
  locale,
  timeZone,
  defaultSurveyTemplateId,
  defaultDuration,
  surveyOptions,
}: {
  locale: Locale;
  timeZone: string;
  defaultSurveyTemplateId: string;
  defaultDuration: number | null;
  surveyOptions: SurveyOption[];
}) {
  const t = useTranslations("account.preferences");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(updatePreferencesAction, initial);
  const feedback = useFeedback(state);
  const knownZone = TIME_ZONE_OPTIONS.some((o) => o.value === timeZone);
  // Idioma escolhido no formulário: os modelos prontos dele aparecem primeiro.
  const [chosenLocale, setChosenLocale] = useState<Locale>(locale);
  const mine = surveyOptions.filter((o) => o.locale === null);
  const localeGroups = [chosenLocale, ...LOCALES.filter((l) => l !== chosenLocale)]
    .map((l) => ({ locale: l, options: surveyOptions.filter((o) => o.locale === l) }))
    .filter((group) => group.options.length > 0);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="locale">{t("locale")}</Label>
          <Select
            id="locale"
            name="locale"
            value={chosenLocale}
            onChange={(e) => setChosenLocale(LOCALES.find((l) => l === e.target.value) ?? locale)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l} lang={l}>
                {LOCALE_NAME[l]}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{t("localeHint")}</p>
        </Field>
        <Field>
          <Label htmlFor="timeZone">{t("timeZone")}</Label>
          <Select id="timeZone" name="timeZone" defaultValue={timeZone}>
            {knownZone ? null : <option value={timeZone}>{timeZone}</option>}
            {TIME_ZONE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">{t("timeZoneHint")}</p>
        </Field>
        <Field>
          <Label htmlFor="defaultSurveyTemplateId">{t("defaultSurvey")}</Label>
          <Select id="defaultSurveyTemplateId" name="defaultSurveyTemplateId" defaultValue={defaultSurveyTemplateId}>
            {mine.length > 0 ? (
              <optgroup label={t("myTemplates")}>
                {mine.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {localeGroups.map((group) => (
              <optgroup key={group.locale} label={LOCALE_NAME[group.locale]}>
                {group.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="defaultDuration">{t("defaultDuration")}</Label>
          <Input id="defaultDuration" name="defaultDuration" type="number" min={1} max={1440} defaultValue={defaultDuration ?? 60} />
        </Field>
        <Field>
          <span className="text-sm font-medium leading-none">{tCommon("theme.label")}</span>
          <ThemeChoice />
          <p className="text-xs text-muted-foreground">{t("themeHint")}</p>
        </Field>
      </div>
      {feedback}
      <div>
        <Button type="submit" disabled={pending} className="max-md:h-11 max-md:w-full">
          {pending ? tCommon("actions.saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("account.password");
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  const feedback = useFeedback(state);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="password">{t("new")}</Label>
          <Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required placeholder={t("newPlaceholder")} />
        </Field>
        <Field>
          <Label htmlFor="confirm">{t("confirm")}</Label>
          <Input id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required />
        </Field>
      </div>
      {feedback}
      <div>
        <Button type="submit" disabled={pending} className="max-md:h-11 max-md:w-full">
          {pending ? t("changing") : t("change")}
        </Button>
      </div>
    </form>
  );
}

export function SignOutOthersButton() {
  const t = useTranslations("account.signOutOthers");
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
      {confirmDialog}
      <Button
        variant="outline"
        disabled={pending}
        className="max-md:h-11 max-md:w-full"
        onClick={async () => {
          const confirmed = await confirm({
            title: t("confirmTitle"),
            description: t("confirmDescription"),
            confirmLabel: t("confirmLabel"),
          });
          if (!confirmed) return;
          startTransition(async () => {
            const result = await signOutOthersAction();
            if (!result.ok) toast.error(result.error);
            else toast.success(t("done"));
          });
        }}
      >
        <LogOutIcon /> {t("button")}
      </Button>
    </>
  );
}

export function DeleteAccountForm() {
  const t = useTranslations("account.delete");
  // A palavra de confirmação muda com o idioma; o servidor confere a mesma.
  const word = t("confirmWord");
  const [state, action, pending] = useActionState(deleteAccountAction, initial);
  const [typed, setTyped] = useState("");
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field>
        <Label htmlFor="confirm-delete">
          {t.rich("typeToConfirm", { word, b: (chunks) => <strong className="font-display">{chunks}</strong> })}
        </Label>
        <Input
          id="confirm-delete"
          name="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="max-w-xs max-md:max-w-none"
        />
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div>
        <Button type="submit" variant="destructive" disabled={pending || typed !== word} className="max-md:h-11 max-md:w-full">
          <TrashIcon /> {pending ? t("deleting") : t("button")}
        </Button>
      </div>
    </form>
  );
}
