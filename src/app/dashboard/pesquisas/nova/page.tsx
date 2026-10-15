import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TemplateEditor } from "@/components/surveys/template-editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("surveys.new");
  return { title: t("metaTitle") };
}

export default async function NewSurveyTemplatePage() {
  const t = await getTranslations("surveys.new");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <TemplateEditor
        templateId={null}
        initial={{
          name: "",
          description: "",
          // Perguntas iniciais no idioma do painel (viram conteúdo do modelo ao salvar).
          questions: [
            {
              kind: "nps",
              label: t("defaultNpsLabel"),
              required: true,
              dimension: "utilidade",
              minLabel: t("defaultNpsMin"),
              maxLabel: t("defaultNpsMax"),
            },
            { kind: "text", label: t("defaultTextLabel"), required: false },
          ],
        }}
      />
    </div>
  );
}
