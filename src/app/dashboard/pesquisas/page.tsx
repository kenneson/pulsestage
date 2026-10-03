import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listSurveyTemplates, type SurveyTemplate } from "@/lib/data/surveys";
import { DIMENSION_LABEL, QUESTION_KIND_META } from "@/lib/domain/survey";
import { plural } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { DeleteTemplateButton, DuplicateTemplateButton } from "@/components/surveys/template-actions";
import { EditIcon, PlusIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Pesquisas" };

function TemplateCard({ template }: { template: SurveyTemplate }) {
  const dimensions = [...new Set(template.questions.flatMap((q) => (q.dimension ? [DIMENSION_LABEL[q.dimension]] : [])))];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-script text-lg">{template.name}</CardTitle>
        {template.description ? <CardDescription>{template.description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {plural(template.questions.length, "pergunta", "perguntas")}
          {dimensions.length > 0 ? ` · mede ${dimensions.join(", ").toLocaleLowerCase("pt-BR")}` : ""}
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-primary">Ver perguntas</summary>
          <ol className="mt-3 flex flex-col gap-2">
            {template.questions.map((q, index) => (
              <li key={q.id} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
                <span className="font-script font-bold tabular-nums">{index + 1}.</span>
                <span>
                  {q.label}
                  {q.required ? " *" : ""}
                  <span className="block text-xs text-muted-foreground">
                    {QUESTION_KIND_META[q.kind].label}
                    {q.dimension ? ` · ${DIMENSION_LABEL[q.dimension]}` : ""}
                    {q.kind === "choice" ? ` · ${(q.settings.options ?? []).join(" / ")}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </details>
        <div className="flex flex-wrap gap-2">
          {template.isPlatform ? (
            <DuplicateTemplateButton templateId={template.id} />
          ) : (
            <>
              <Link href={`/dashboard/pesquisas/${template.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <EditIcon /> Editar
              </Link>
              <DuplicateTemplateButton templateId={template.id} label="Duplicar" />
              <DeleteTemplateButton templateId={template.id} name={template.name} />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function SurveysPage() {
  const supabase = await createClient();
  const templates = await listSurveyTemplates(supabase);
  const platform = templates.filter((t) => t.isPlatform);
  const mine = templates.filter((t) => !t.isPlatform);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">Pesquisas</h1>
          <p className="text-muted-foreground">
            A pesquisa que a plateia responde ao fim da sessão, sobre a palestra ou aula como um todo. Escolha o modelo de
            cada sessão no formulário dela; sem escolha, vale a “Avaliação geral”.
          </p>
        </div>
        <Link href="/dashboard/pesquisas/nova" className={buttonVariants()}>
          <PlusIcon /> Novo modelo
        </Link>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">Meus modelos</h2>
        {mine.length === 0 ? (
          <EmptyState
            title="Você ainda não criou modelos"
            description="Crie do zero ou duplique um modelo pronto para ajustar as perguntas."
            action={
              <Link href="/dashboard/pesquisas/nova" className={buttonVariants({ variant: "outline" })}>
                Criar modelo
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {mine.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-semibold">Modelos prontos</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {platform.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      </section>
    </div>
  );
}
