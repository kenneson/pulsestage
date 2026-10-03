import type { Metadata } from "next";
import { TemplateEditor } from "@/components/surveys/template-editor";

export const metadata: Metadata = { title: "Novo modelo de pesquisa" };

export default function NewSurveyTemplatePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo modelo de pesquisa</h1>
        <p className="text-muted-foreground">Monte as perguntas que a plateia responde ao fim da sessão.</p>
      </div>
      <TemplateEditor
        templateId={null}
        initial={{
          name: "",
          description: "",
          questions: [
            {
              kind: "nps",
              label: "De 0 a 10, quanto esta sessão foi útil para você?",
              required: true,
              dimension: "utilidade",
              minLabel: "Nada útil",
              maxLabel: "Extremamente útil",
            },
            { kind: "text", label: "O que poderia melhorar?", required: false },
          ],
        }}
      />
    </div>
  );
}
