import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionForm } from "@/components/sessions/session-form";
import { createClient } from "@/lib/supabase/server";
import { generalTemplateId, listSurveyTemplates } from "@/lib/data/surveys";
import { getSpeakerProfile } from "@/lib/data/profile";
import { stepStates } from "@/lib/domain/session-steps";
import { SessionStepper, StepFooterSpacer } from "@/components/sessions/session-stepper";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("session.new");
  return { title: t("metaTitle") };
}

export default async function NewSessionPage() {
  const supabase = await createClient();
  const [templates, profile, t] = await Promise.all([
    listSurveyTemplates(supabase),
    getSpeakerProfile(),
    getTranslations("session.new"),
  ]);
  const tForm = await getTranslations("session.form");
  const { data: brand } = await supabase.from("profiles").select("brand_logo_path, brand_color").eq("id", profile.id).maybeSingle();
  const surveyOptions = templates.map((t) => ({ id: t.id, name: t.name, isPlatform: t.isPlatform, locale: t.locale, slug: t.slug }));
  const defaultSurvey =
    templates.find((t) => t.id === profile.defaultSurveyTemplateId)?.id ?? generalTemplateId(templates, profile.locale) ?? "";

  // A sessão ainda não existe: a linha do tempo mostra os próximos passos desabilitados.
  const states = stepStates({ created: false, slideCount: 0, interactionCount: 0, surveyTemplateId: null, raffleEnabled: false });

  return (
    <div className="flex flex-col gap-6">
      <SessionStepper sessionId={null} current="configuracoes" states={states} />
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <SessionForm
              surveyOptions={surveyOptions}
              hasBrand={Boolean(brand?.brand_logo_path || brand?.brand_color)}
              stepSubmitLabel={tForm("createNext")}
              defaults={{
                title: "",
                description: "",
                date: "",
                time: "",
                duration: String(profile.defaultDurationMinutes ?? 60),
                joinCode: "",
                surveyTemplateId: defaultSurvey,
                locale: profile.locale,
                pace: "live",
                useBrand: true,
              }}
            />
          </CardContent>
        </Card>
      </div>
      <StepFooterSpacer />
    </div>
  );
}
