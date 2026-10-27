"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  changePasswordAction,
  deleteAccountAction,
  removeAvatarAction,
  saveBrandAction,
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
import { CameraIcon, CheckIcon, ImageIcon, LogOutIcon, TrashIcon } from "@/components/icons";
import { brandPalette, checkBrandColor, SURFACE_DARK, SURFACE_LIGHT, type BrandTone } from "@/lib/domain/brand";
import { BrandLogoError, uploadBrandLogo } from "@/lib/brand/upload";
import { brandLogoSrc } from "@/lib/brand/url";
import { translateAnyMessage, type AnyTranslator } from "@/i18n/errors";

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

// ---------------------------------------------------------------------------
// Marca
// ---------------------------------------------------------------------------

/** Azul acadêmico do PulseStage (o `--primary` claro): ponto de partida do seletor. */
const DEFAULT_BRAND_COLOR = "#245fd4";
const HEX_INPUT = /^#[0-9a-fA-F]{6}$/;

/** Celular da plateia, em miniatura, no tema claro. */
function PhonePreview({ tone, logoUrl }: { tone: BrandTone; logoUrl: string | null }) {
  const t = useTranslations("account.brand.preview");
  return (
    <figure className="flex flex-col items-center gap-2">
      <div
        aria-hidden
        className="flex aspect-[9/17] w-40 flex-col gap-2 rounded-[1.6rem] border-4 border-foreground/80 p-2.5 text-[0.6rem] leading-tight"
        style={{ background: SURFACE_LIGHT, color: "#1b2236" }}
      >
        <div className="flex h-6 items-center justify-between gap-1 border-b border-black/10 pb-1">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia do logo recém-enviado
            <img src={logoUrl} alt="" className="h-5 w-auto max-w-20 object-contain" />
          ) : (
            <span className="font-display font-bold">{t("sessionTitle")}</span>
          )}
          <span className="size-2 rounded-full" style={{ background: tone.primary }} />
        </div>
        <p className="font-display text-[0.7rem] font-semibold">{t("question")}</p>
        {[t("optionA"), t("optionB"), t("optionC")].map((label, i) => (
          <span
            key={label}
            className="rounded-md border px-2 py-1.5"
            style={i === 1 ? { background: tone.primary, color: tone.foreground, borderColor: tone.primary } : { borderColor: "#d5dae5" }}
          >
            {label}
          </span>
        ))}
        <span className="mt-auto rounded-md py-1.5 text-center font-semibold" style={{ background: tone.primary, color: tone.foreground }}>
          {t("send")}
        </span>
      </div>
      <figcaption className="text-xs text-muted-foreground">{t("phone")}</figcaption>
    </figure>
  );
}

/** Telão em miniatura (sempre escuro, como o de verdade). */
function ScreenPreview({ tone, logoUrl }: { tone: BrandTone; logoUrl: string | null }) {
  const t = useTranslations("account.brand.preview");
  const bars = [72, 46, 28];
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <div
        aria-hidden
        className="flex aspect-video w-full flex-col gap-2 rounded-md border p-3 text-[0.65rem] sm:p-4"
        style={{ background: SURFACE_DARK, color: "#eef1f7" }}
      >
        <p className="font-display text-sm font-semibold sm:text-base">{t("question")}</p>
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          {[t("optionA"), t("optionB"), t("optionC")].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-16 shrink-0 truncate">{label}</span>
              <span className="h-3 rounded-sm" style={{ width: `${bars[i]}%`, background: tone.primary }} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-1.5">
          <span>
            {t("joinAt")} <strong className="font-display" style={{ color: tone.primary }}>482 913</strong>
          </span>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia do logo recém-enviado
            <img src={logoUrl} alt="" className="h-5 w-auto max-w-24 rounded-sm bg-white/90 object-contain px-1" />
          ) : null}
        </div>
      </div>
      <figcaption className="text-xs text-muted-foreground">{t("screen")}</figcaption>
    </figure>
  );
}

/** Uma linha do diagnóstico de contraste. */
function ContrastLine({ ok, text, swatch }: { ok: boolean; text: string; swatch?: string }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${ok ? "bg-primary/15 text-primary" : "bg-standby/25 text-standby-foreground dark:text-standby"}`}
      >
        {ok ? <CheckIcon className="size-3" /> : <span className="text-[0.6rem] font-bold">!</span>}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        {text}
        {swatch ? <span aria-hidden className="inline-block size-3.5 rounded-sm border" style={{ background: swatch }} /> : null}
      </span>
    </li>
  );
}

/**
 * Logo e cor do palestrante. O logo é reduzido no navegador e salvo na hora; a cor tem prévia ao vivo
 * (celular claro e telão escuro) e o diagnóstico de contraste antes de salvar.
 */
export function BrandForm({ logoPath, color }: { logoPath: string | null; color: string | null }) {
  const t = useTranslations("account.brand");
  const tAll = useTranslations();
  const tCommon = useTranslations("common.actions");
  const locale = useLocale();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [savedLogo, setSavedLogo] = useState(logoPath);
  const [savedColor, setSavedColor] = useState(color);
  const [draft, setDraft] = useState(color ?? DEFAULT_BRAND_COLOR);
  const [hexText, setHexText] = useState(color ?? DEFAULT_BRAND_COLOR);
  const [uploading, setUploading] = useState(false);
  const [saving, startSaving] = useTransition();

  const valid = HEX_INPUT.test(draft);
  const current = valid ? draft.toLowerCase() : DEFAULT_BRAND_COLOR;
  const palette = brandPalette(current);
  const check = checkBrandColor(current);
  const logoUrl = savedLogo ? brandLogoSrc(savedLogo) : null;
  const ratio = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n);
  const translateKey = (message: string) => translateAnyMessage(tAll as unknown as AnyTranslator, message);

  const save = (next: { logoPath: string | null; color: string | null }, success: string) =>
    startSaving(async () => {
      const result = await saveBrandAction(next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSavedLogo(next.logoPath);
      setSavedColor(next.color);
      toast.success(success);
      router.refresh();
    });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadBrandLogo(file);
      save({ logoPath: path, color: savedColor }, t("success.logoSaved"));
    } catch (error) {
      toast.error(error instanceof BrandLogoError ? translateKey(error.message) : t("errors.uploadFailed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const busy = uploading || saving;
  const dirty = valid && current !== (savedColor ?? DEFAULT_BRAND_COLOR);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium">{t("logo")}</span>
        <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-stretch">
          <div className="flex h-16 w-28 shrink-0 max-sm:h-20 max-sm:w-full items-center justify-center rounded-md border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:12px_12px] p-1.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo público do Storage
              <img src={logoUrl} alt={t("logoAltPreview")} className="max-h-full max-w-full object-contain" />
            ) : (
              <ImageIcon className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap gap-2 max-sm:grid max-sm:grid-cols-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label={t("chooseLogo")}
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()} className="max-md:h-11 max-md:text-sm">
                <CameraIcon /> {uploading ? tCommon("sending") : savedLogo ? t("changeLogo") : t("chooseLogo")}
              </Button>
              {savedLogo ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  className="max-md:h-11 max-md:text-sm"
                  onClick={() => save({ logoPath: null, color: savedColor }, t("success.logoRemoved"))}
                >
                  {tCommon("remove")}
                </Button>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">{t("logoHint")}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label htmlFor="brand-color-hex">{t("color")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={current}
            aria-label={t("colorPicker")}
            onChange={(e) => {
              setDraft(e.target.value);
              setHexText(e.target.value);
            }}
            className="h-11 w-14 shrink-0 cursor-pointer rounded-md border bg-transparent p-1 md:h-10"
          />
          <Input
            id="brand-color-hex"
            value={hexText}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!HEX_INPUT.test(hexText)}
            onChange={(e) => {
              const value = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
              setHexText(value);
              if (HEX_INPUT.test(value)) setDraft(value);
            }}
            className="w-32 font-mono uppercase"
          />
          <span className="text-xs text-muted-foreground">{savedColor ? t("colorSaved") : t("colorDefault")}</span>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm" aria-live="polite">
          <ContrastLine
            ok={check.foregroundContrast >= 4.5}
            text={t(check.foreground === "#ffffff" ? "check.textWhite" : "check.textDark", { ratio: ratio(check.foregroundContrast) })}
          />
          <ContrastLine
            ok={check.readableOnLight}
            text={check.readableOnLight ? t("check.lightOk", { ratio: ratio(check.onLight) }) : t("check.lightAdjusted", { ratio: ratio(check.onLight) })}
            swatch={check.readableOnLight ? undefined : palette.light.primary}
          />
          <ContrastLine
            ok={check.readableOnDark}
            text={check.readableOnDark ? t("check.darkOk", { ratio: ratio(check.onDark) }) : t("check.darkAdjusted", { ratio: ratio(check.onDark) })}
            swatch={check.readableOnDark ? undefined : palette.dark.primary}
          />
        </ul>
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-[auto_1fr]">
        <PhonePreview tone={palette.light} logoUrl={logoUrl} />
        <ScreenPreview tone={palette.dark} logoUrl={logoUrl} />
      </div>
      <p className="text-xs text-muted-foreground">{t("where")}</p>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !dirty} onClick={() => save({ logoPath: savedLogo, color: current }, t("success.colorSaved"))} className="max-md:h-11 max-md:w-full">
          {saving ? tCommon("saving") : t("saveColor")}
        </Button>
        {savedColor ? (
          <Button
            variant="ghost"
            disabled={busy}
            className="max-md:h-11 max-md:w-full"
            onClick={() => {
              setDraft(DEFAULT_BRAND_COLOR);
              setHexText(DEFAULT_BRAND_COLOR);
              save({ logoPath: savedLogo, color: null }, t("success.colorRemoved"));
            }}
          >
            {t("resetColor")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
