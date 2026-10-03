import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getSpeakerProfile } from "@/lib/data/profile";
import { listSurveyTemplates } from "@/lib/data/surveys";
import { buttonVariants } from "@/components/ui/button";
import {
  AvatarForm,
  DeleteAccountForm,
  PasswordForm,
  PreferencesForm,
  ProfileForm,
  SignOutOthersButton,
} from "@/components/account/account-forms";
import { CheckIcon, DownloadIcon, LockIcon, MailIcon, SettingsIcon, ShieldIcon, UserIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Conta e configurações" };

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
      className={`flex scroll-mt-6 flex-col gap-5 rounded-md bg-card p-6 shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border ${className}`}
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

const SECTIONS = [
  { id: "perfil", label: "Perfil", icon: UserIcon },
  { id: "preferencias", label: "Preferências", icon: SettingsIcon },
  { id: "seguranca", label: "Segurança", icon: LockIcon },
  { id: "privacidade", label: "Privacidade", icon: ShieldIcon },
];

export default async function AccountPage() {
  const profile = await getSpeakerProfile();
  const supabase = await createClient();
  const [{ data: auth }, templates] = await Promise.all([supabase.auth.getUser(), listSurveyTemplates(supabase)]);
  const providers = new Set((auth.user?.identities ?? []).map((i) => i.provider));
  const defaultSurvey = profile.defaultSurveyTemplateId ?? templates.find((t) => t.slug === "geral")?.id ?? "";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conta e configurações</h1>
        <p className="text-muted-foreground">Seu perfil, preferências, acesso e dados.</p>
      </div>

      <nav aria-label="Seções da conta" className="flex flex-wrap gap-1 border-b">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <s.icon /> {s.label}
          </a>
        ))}
      </nav>

      <Section id="perfil" title="Perfil">
        <AvatarForm src={profile.avatarUrl} name={profile.name} email={profile.email} />
        <ProfileForm name={profile.name} email={profile.email} bio={profile.bio} />
      </Section>

      <Section id="preferencias" title="Preferências" description="Valores usados ao criar uma sessão e para mostrar datas.">
        <PreferencesForm
          timeZone={profile.timeZone}
          defaultSurveyTemplateId={defaultSurvey}
          defaultDuration={profile.defaultDurationMinutes}
          surveyOptions={templates.map((t) => ({ id: t.id, name: t.isPlatform ? t.name : `${t.name} (meu)` }))}
        />
      </Section>

      <Section id="seguranca" title="Segurança">
        <ul className="divide-y rounded-md border">
          <li className="flex items-center gap-3 px-4 py-3">
            <MailIcon className="text-muted-foreground" />
            <span className="flex-1">E-mail e senha</span>
            {providers.has("email") ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                <CheckIcon /> Ativo
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Defina uma senha abaixo para ativar</span>
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
                <CheckIcon /> Conectado
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Entre com o Google uma vez para conectar</span>
            )}
          </li>
        </ul>
        <PasswordForm />
        <div className="border-t pt-5">
          <SignOutOthersButton />
        </div>
      </Section>

      <Section id="privacidade" title="Privacidade e dados">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-md">
            <p className="font-medium">Exportar meus dados</p>
            <p className="text-sm text-muted-foreground">
              Um arquivo JSON com seu perfil, sessões, perguntas, respostas, pesquisas e insights.
            </p>
          </div>
          <a href="/dashboard/conta/exportar" className={buttonVariants({ variant: "outline" })} download>
            <DownloadIcon /> Exportar
          </a>
        </div>
        <div className="flex flex-col gap-4 rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <p className="font-semibold text-destructive">Excluir conta</p>
            <p className="text-sm text-muted-foreground">
              Apaga para sempre seu perfil, todas as sessões, respostas, pesquisas, insights e os contatos de participantes.
              Não dá para desfazer.
            </p>
          </div>
          <DeleteAccountForm />
        </div>
      </Section>
    </div>
  );
}
