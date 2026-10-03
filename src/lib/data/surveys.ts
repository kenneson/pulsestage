import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { SurveyTemplateQuestionRow, SurveyTemplateRow } from "@/lib/supabase/types";
import { toSurveyQuestions, type SurveyQuestion } from "@/lib/domain/survey";

// Modelos de pesquisa visíveis ao speaker logado (RLS: os da plataforma e os próprios).

export type SurveyTemplate = SurveyTemplateRow & { questions: SurveyQuestion[]; isPlatform: boolean };

function withQuestions(
  templates: SurveyTemplateRow[],
  questions: SurveyTemplateQuestionRow[],
): SurveyTemplate[] {
  return templates.map((t) => ({
    ...t,
    isPlatform: t.owner_id === null,
    questions: toSurveyQuestions(questions.filter((q) => q.template_id === t.id)),
  }));
}

/** Modelos da plataforma primeiro (na ordem de criação), depois os do speaker. */
export async function listSurveyTemplates(supabase: ServerSupabase): Promise<SurveyTemplate[]> {
  const [templates, questions] = await Promise.all([
    supabase.from("survey_templates").select("*").order("created_at"),
    supabase.from("survey_template_questions").select("*").order("position"),
  ]);
  if (templates.error) throw new Error(templates.error.message);
  if (questions.error) throw new Error(questions.error.message);
  const all = withQuestions(templates.data, questions.data);
  return [...all.filter((t) => t.isPlatform), ...all.filter((t) => !t.isPlatform)];
}

export async function getSurveyTemplate(supabase: ServerSupabase, id: string): Promise<SurveyTemplate | null> {
  const [template, questions] = await Promise.all([
    supabase.from("survey_templates").select("*").eq("id", id).maybeSingle(),
    supabase.from("survey_template_questions").select("*").eq("template_id", id).order("position"),
  ]);
  if (template.error) throw new Error(template.error.message);
  if (questions.error) throw new Error(questions.error.message);
  return template.data ? withQuestions([template.data], questions.data)[0] ?? null : null;
}
