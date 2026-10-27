import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getSpeakerProfile } from "@/lib/data/profile";
import { SESSION_TEMPLATES, templatePreview, type SessionTemplate } from "@/lib/domain/session-templates";
import { TypeTag } from "@/components/interaction-type-tag";
import { UseTemplateButton } from "@/components/templates/use-template-button";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeftIcon, ClockIcon, PlusIcon, UsersIcon } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("templates.page");
  return { title: t("metaTitle") };
}

const CARD =
  "flex flex-col gap-4 rounded-md bg-card p-5 text-card-foreground shadow-[0_10px_28px_-18px_color-mix(in_oklch,var(--foreground)_32%,transparent)] dark:border max-md:p-4";

export default async function SessionTemplatesPage() {
  const profile = await getSpeakerProfile();
  // Prévia no idioma das perguntas que serão criadas (o do palestrante); botões no idioma do painel.
  const [t, tContent] = await Promise.all([
    getTranslations("templates.page"),
    getTranslations({ locale: profile.locale, namespace: "templates" }),
  ]);
  const text = (key: string) => (tContent as unknown as (key: string) => string)(key);

  const card = (template: SessionTemplate) => {
    const name = text(`items.${template.id}.name`);
    const preview = templatePreview(template, text);
    return (
      <li key={template.id} className={CARD} aria-labelledby={`tpl-${template.id}`}>
        <div className="flex flex-col gap-2">
          <ul className="flex flex-wrap gap-1.5">
            {template.audiences.map((a) => (
              <li key={a} className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t(`audiences.${a}`)}
              </li>
            ))}
          </ul>
          <h2 id={`tpl-${template.id}`} className="font-display text-lg font-semibold leading-tight">
            {name}
          </h2>
          <p className="text-sm text-muted-foreground">{text(`items.${template.id}.summary`)}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{t("questions", { count: template.questions.length })}</span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3.5" /> {t("minutes", { count: template.durationMinutes })}
            </span>
            {template.pace === "self" ? <span className="font-medium text-foreground">{t("selfPaced")}</span> : null}
            {template.teams ? (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <UsersIcon className="size-3.5" /> {t("teams")}
              </span>
            ) : null}
          </p>
        </div>
        <ol aria-label={t("previewLabel", { name })} className="flex flex-1 flex-col gap-2 border-t pt-3">
          {preview.map((q, index) => (
            <li key={index} className="flex flex-col gap-1">
              <TypeTag type={q.type} className="text-[0.65rem]" />
              <span className="text-sm leading-snug">{q.title}</span>
            </li>
          ))}
        </ol>
        <UseTemplateButton templateId={template.id} label={t("use")} pendingLabel={t("creating")} className="md:self-start" />
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard/sessions"
          className="inline-flex min-h-11 w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:min-h-0"
        >
          <ChevronLeftIcon /> {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("metaTitle")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("editHint")}</p>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={t("listLabel")}>
        {SESSION_TEMPLATES.map(card)}
        <li className={`${CARD} justify-between border border-dashed bg-transparent shadow-none`}>
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-semibold leading-tight">{t("fromScratch")}</h2>
            <p className="text-sm text-muted-foreground">{t("fromScratchDescription")}</p>
          </div>
          <Link href="/dashboard/sessions/new" className={buttonVariants({ variant: "outline", className: "max-md:w-full md:self-start" })}>
            <PlusIcon /> {t("fromScratch")}
          </Link>
        </li>
      </ul>
    </div>
  );
}
