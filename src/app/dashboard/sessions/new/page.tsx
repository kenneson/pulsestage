import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionForm } from "@/components/sessions/session-form";
import { createClient } from "@/lib/supabase/server";
import { listSurveyTemplates } from "@/lib/data/surveys";
import { getSpeakerProfile } from "@/lib/data/profile";

export const metadata: Metadata = { title: "Nova sessão" };

export default async function NewSessionPage() {
  const [templates, profile] = await Promise.all([listSurveyTemplates(await createClient()), getSpeakerProfile()]);
  const surveyOptions = templates.map((t) => ({ id: t.id, name: t.name, isPlatform: t.isPlatform }));
  const defaultSurvey =
    templates.find((t) => t.id === profile.defaultSurveyTemplateId)?.id ?? templates.find((t) => t.slug === "geral")?.id ?? "";

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Nova sessão</CardTitle>
          <CardDescription>Uma palestra, aula, workshop ou treinamento. Depois você adiciona as interações.</CardDescription>
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
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
