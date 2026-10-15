import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionForm } from "@/components/sessions/session-form";
import { createClient } from "@/lib/supabase/server";
import { generalTemplateId, listSurveyTemplates } from "@/lib/data/surveys";
import { getSpeakerProfile } from "@/lib/data/profile";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("session.new");
  return { title: t("metaTitle") };
}

export default async function NewSessionPage() {
  const [templates, profile, t] = await Promise.all([
    listSurveyTemplates(await createClient()),
    getSpeakerProfile(),
    getTranslations("session.new"),
  ]);
  const surveyOptions = templates.map((t) => ({ id: t.id, name: t.name, isPlatform: t.isPlatform, locale: t.locale, slug: t.slug }));
  const defaultSurvey =
    templates.find((t) => t.id === profile.defaultSurveyTemplateId)?.id ?? generalTemplateId(templates, profile.locale) ?? "";

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionForm
            surveyOptions={surveyOptions}
            defaults={{
              title: "",
              description: "",
              date: "",
              time: "",
              duration: String(profile.defaultDurationMinutes ?? 60),
              joinCode: "",
              surveyTemplateId: defaultSurvey,
              locale: profile.locale,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
