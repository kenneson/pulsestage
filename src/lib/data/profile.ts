import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_TIME_ZONE } from "@/lib/datetime";

export type SpeakerProfile = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  bio: string | null;
  timeZone: string;
  defaultSurveyTemplateId: string | null;
  defaultDurationMinutes: number | null;
};

/** Perfil do speaker logado, lido uma vez por requisição. Redireciona ao login sem sessão. */
export const getSpeakerProfile = cache(async (): Promise<SpeakerProfile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email ?? "",
    name: data?.name ?? null,
    avatarUrl: data?.avatar_url ?? null,
    bio: data?.bio ?? null,
    timeZone: data?.time_zone ?? APP_TIME_ZONE,
    defaultSurveyTemplateId: data?.default_survey_template_id ?? null,
    defaultDurationMinutes: data?.default_duration_minutes ?? null,
  };
});
