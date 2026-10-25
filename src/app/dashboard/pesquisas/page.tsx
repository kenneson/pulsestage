import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { listSurveyTemplates, type SurveyTemplate } from "@/lib/data/surveys";
import { LOCALE_NAME, LOCALES, localeOrDefault } from "@/lib/domain/locale";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { DeleteTemplateButton, DuplicateTemplateButton } from "@/components/surveys/template-actions";
import { EditIcon, PlusIcon } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("surveys.list");
  return { title: t("metaTitle") };
}

async function TemplateCard({ template }: { template: SurveyTemplate }) {
  const [t, tDomain, tCommon, locale] = await Promise.all([
    getTranslations("surveys.card"),
    getTranslations("domain"),
    getTranslations("common.actions"),
    getLocale(),
  ]);
  const dimensions = [
    ...new Set(template.questions.flatMap((q) => (q.dimension ? [tDomain(`dimensions.${q.dimension}`)] : []))),
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg">{template.name}</CardTitle>
        {template.description ? <CardDescription>{template.description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {t("questions", { count: template.questions.length })}
          {dimensions.length > 0
            ? ` · ${t("measures", { dimensions: dimensions.join(", ").toLocaleLowerCase(locale) })}`
            : ""}
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-primary max-md:-my-3 max-md:py-3">{t("showQuestions")}</summary>
          <ol className="mt-3 flex flex-col gap-2">
            {template.questions.map((q, index) => (
              <li key={q.id} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
                <span className="font-display font-bold tabular-nums">{index + 1}.</span>
                <span>
                  {q.label}
                  {q.required ? " *" : ""}
                  <span className="block text-xs text-muted-foreground">
                    {tDomain(`surveyKinds.${q.kind}.label`)}
                    {q.dimension ? ` · ${tDomain(`dimensions.${q.dimension}`)}` : ""}
                    {q.kind === "choice" ? ` · ${(q.settings.options ?? []).join(" / ")}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </details>
        <div className="flex flex-wrap gap-2 max-md:[&>a]:h-11 max-md:[&>a]:text-sm max-md:[&>button]:h-11 max-md:[&>button]:text-sm">
          {template.isPlatform ? (
            <DuplicateTemplateButton templateId={template.id} />
          ) : (
            <>
              <Link href={`/dashboard/pesquisas/${template.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <EditIcon /> {tCommon("edit")}
              </Link>
              <DuplicateTemplateButton templateId={template.id} label={tCommon("duplicate")} />
              <DeleteTemplateButton templateId={template.id} name={template.name} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateGrid({ templates }: { templates: SurveyTemplate[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} />
      ))}
    </div>
  );
}

export default async function SurveysPage() {
  const supabase = await createClient();
  const [templates, t, locale] = await Promise.all([
    listSurveyTemplates(supabase),
    getTranslations("surveys.list"),
    getLocale(),
  ]);
  const platform = templates.filter((x) => x.isPlatform);
  const mine = templates.filter((x) => !x.isPlatform);
  // Modelos prontos no idioma do painel; os dos outros idiomas ficam recolhidos, agrupados pelo nome nativo.
  const here = platform.filter((x) => localeOrDefault(x.locale) === locale);
  const others = LOCALES.filter((l) => l !== locale)
    .map((l) => ({ locale: l, templates: platform.filter((x) => localeOrDefault(x.locale) === l) }))
    .filter((group) => group.templates.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Link href="/dashboard/pesquisas/nova" className={buttonVariants({ className: "max-md:h-11" })}>
          <PlusIcon /> {t("newTemplate")}
        </Link>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">{t("mine")}</h2>
        {mine.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <Link href="/dashboard/pesquisas/nova" className={buttonVariants({ variant: "outline" })}>
                {t("createTemplate")}
              </Link>
            }
          />
        ) : (
          <TemplateGrid templates={mine} />
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">{t("platform")}</h2>
        {here.length > 0 ? (
          <TemplateGrid templates={here} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("platformEmpty")}</p>
        )}
      </section>

      {others.length > 0 ? (
        <section className="flex flex-col gap-4">
          <details>
            <summary className="cursor-pointer font-semibold text-primary max-md:-my-2.5 max-md:py-2.5">{t("otherLocales")}</summary>
            <div className="mt-4 flex flex-col gap-6">
              <p className="text-sm text-muted-foreground">{t("otherLocalesHint")}</p>
              {others.map((group) => (
                <div key={group.locale} className="flex flex-col gap-3">
                  <h3 lang={group.locale} className="text-sm font-semibold">{LOCALE_NAME[group.locale]}</h3>
                  <TemplateGrid templates={group.templates} />
                </div>
              ))}
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}
