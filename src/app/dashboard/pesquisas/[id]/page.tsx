import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSurveyTemplate } from "@/lib/data/surveys";
import { questionToDraft } from "@/lib/domain/survey";
import { isUuid } from "@/lib/action-result";
import { TemplateEditor } from "@/components/surveys/template-editor";

export const metadata: Metadata = { title: "Editar modelo de pesquisa" };

export default async function EditSurveyTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const template = await getSurveyTemplate(supabase, id);
  if (!template) notFound();
  // Modelos prontos não são editáveis: a lista oferece "Duplicar e editar".
  if (template.isPlatform) redirect("/dashboard/pesquisas");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar modelo</h1>
        <p className="text-muted-foreground">
          As mudanças valem para as próximas sessões. Relatórios de sessões já encerradas não mudam.
        </p>
      </div>
      <TemplateEditor
        templateId={template.id}
        initial={{
          name: template.name,
          description: template.description ?? "",
          questions: template.questions.map(questionToDraft),
        }}
      />
    </div>
  );
}
