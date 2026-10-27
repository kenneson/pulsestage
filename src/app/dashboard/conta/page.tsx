import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSpeakerProfile } from "@/lib/data/profile";
import { generalTemplateId, listSurveyTemplates } from "@/lib/data/surveys";
import { localeOrDefault } from "@/lib/domain/locale";
import { buttonVariants } from "@/components/ui/button";
import {
  AvatarForm,
  BrandForm,
  DeleteAccountForm,
  PasswordForm,
  PreferencesForm,
  ProfileForm,
  SignOutOthersButton,
} from "@/components/account/account-forms";
import { CheckIcon, DownloadIcon, ImageIcon, LockIcon, MailIcon, SettingsIcon, ShieldIcon, UserIcon } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.page");
  return { title: t("metaTitle") };
}

function Section({
  id,
  title,
  description,
  children,
  className = "",
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`flex scroll-mt-6 flex-col gap-5 rounded-md bg-card p-6 shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border max-md:gap-4 max-md:p-4 ${className}`}
    >
      <div>
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

// Âncoras ficam em português (links do guia e do painel apontam para elas).
const SECTIONS = [
  { id: "perfil", label: "profile", icon: UserIcon },
  { id: "preferencias", label: "preferences", icon: SettingsIcon },
  { id: "marca", label: "brand", icon: ImageIcon },
  { id: "seguranca", label: "security", icon: LockIcon },
  { id: "privacidade", label: "privacy", icon: ShieldIcon },
] as const;

export default async function AccountPage() {
  const profile = await getSpeakerProfile();
  const supabase = await createClient();
  const [{ data: auth }, brand, templates, t, tSections] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("brand_logo_path, brand_color").eq("id", profile.id).maybeSingle(),
    listSurveyTemplates(supabase),
    getTranslations("account"),
    getTranslations("account.sections"),
  ]);
  const providers = new Set((auth.user?.identities ?? []).map((i) => i.provider));
  const defaultSurvey = profile.defaultSurveyTemplateId ?? generalTemplateId(templates, profile.locale) ?? "";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("page.title")}</h1>
        <p className="text-muted-foreground">{t("page.description")}</p>
      </div>

      {/* Celular: uma linha só, que rola de lado se faltar espaço (em vez de quebrar em duas). */}
      <nav
        aria-label={t("page.navLabel")}
        className="flex flex-wrap gap-1 border-b max-md:-mx-4 max-md:flex-nowrap max-md:gap-0 max-md:overflow-x-auto max-md:px-2 max-md:[scrollbar-width:none]"
      >
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-muted-foreground hover:text-foreground max-md:shrink-0 max-md:whitespace-nowrap"
          >
            <s.icon /> {tSections(s.label)}
          </a>
        ))}
      </nav>

      <Section id="perfil" title={tSections("profile")}>
        <AvatarForm src={profile.avatarUrl} name={profile.name} email={profile.email} />
        <ProfileForm name={profile.name} email={profile.email} bio={profile.bio} />
      </Section>

      <Section id="preferencias" title={tSections("preferences")} description={tSections("preferencesDescription")}>
        <PreferencesForm
          locale={profile.locale}
          timeZone={profile.timeZone}
          defaultSurveyTemplateId={defaultSurvey}
          defaultDuration={profile.defaultDurationMinutes}
          surveyOptions={templates.map((x) => ({
            id: x.id,
            name: x.name,
            // null = modelo do próprio speaker (aparece em "Meus modelos").
            locale: x.isPlatform ? localeOrDefault(x.locale) : null,
          }))}
        />
      </Section>

      <Section id="marca" title={tSections("brand")} description={tSections("brandDescription")}>
        <BrandForm logoPath={brand.data?.brand_logo_path ?? null} color={brand.data?.brand_color ?? null} />
      </Section>

      <Section id="seguranca" title={tSections("security")}>
        <ul className="divide-y rounded-md border">
          <li className="flex items-center gap-3 px-4 py-3">
            <MailIcon className="text-muted-foreground" />
            <span className="flex-1">{t("security.emailPassword")}</span>
            {providers.has("email") ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                <CheckIcon /> {t("security.active")}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">{t("security.activateHint")}</span>
            )}
          </li>
          <li className="flex items-center gap-3 px-4 py-3">
            <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0">
              <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1C3.3 21.4 7.3 24 12 24z" />
              <path fill="#FBBC05" d="M5.3 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5h-4C.5 8.2 0 10 0 12s.5 3.8 1.3 5.5l4-3.1z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.6 1.3 6.5l4 3.1c1-2.8 3.6-4.8 6.7-4.8z" />
            </svg>
            <span className="flex-1">Google</span>
            {providers.has("google") ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                <CheckIcon /> {t("security.connected")}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">{t("security.connectHint")}</span>
            )}
          </li>
        </ul>
        <PasswordForm />
        <div className="border-t pt-5">
          <SignOutOthersButton />
        </div>
      </Section>

      <Section id="privacidade" title={tSections("privacyTitle")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-md">
            <p className="font-medium">{t("privacy.exportTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("privacy.exportDescription")}</p>
          </div>
          <a href="/dashboard/conta/exportar" className={buttonVariants({ variant: "outline", className: "max-md:h-11 max-md:w-full" })} download>
            <DownloadIcon /> {t("privacy.export")}
          </a>
        </div>
        <div className="flex flex-col gap-4 rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <p className="font-semibold text-destructive">{t("privacy.deleteTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("privacy.deleteDescription")}</p>
          </div>
          <DeleteAccountForm />
        </div>
      </Section>
    </div>
  );
}
