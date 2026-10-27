"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { setSurveyTemplateAction } from "@/features/sessions/actions";
import type { QuestionKind } from "@/lib/domain/survey";
import { cn } from "@/lib/utils";
import { ChevronRightIcon, LockIcon } from "@/components/icons";

export type SurveyStepTemplate = {
  id: string;
  name: string;
  description: string | null;
  isPlatform: boolean;
  questions: { id: string; label: string; kind: QuestionKind; required: boolean; options: string[] }[];
};

function QuestionPreview({ template }: { template: SurveyStepTemplate }) {
  const t = useTranslations("session.survey");
  const tDomain = useTranslations("domain");
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4 max-md:p-3">
      <p className="text-sm font-medium">{t("previewTitle", { name: template.name })}</p>
      {template.description ? <p className="text-xs text-muted-foreground">{template.description}</p> : null}
      <ol className="flex flex-col gap-2">
        {template.questions.map((q, index) => (
          <li key={q.id} className="grid grid-cols-[1.5rem_1fr] gap-x-2 text-sm">
            <span className="font-display font-bold tabular-nums">{index + 1}.</span>
            <span className="min-w-0">
              {q.label}
              {q.required ? " *" : ""}
              <span className="block text-xs text-muted-foreground">
                {tDomain(`surveyKinds.${q.kind}.label`)}
                {q.kind === "choice" && q.options.length ? ` · ${q.options.join(" / ")}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Passo "Pesquisa pós-evento": modelos prontos (no idioma da sessão) e os do palestrante, com a prévia das
 * perguntas do escolhido. Salva ao escolher. Depois de encerrada, mostra o modelo usado, travado.
 */
export function SurveyStep({
  sessionId,
  templates,
  selectedId,
  locked,
}: {
  sessionId: string;
  templates: SurveyStepTemplate[];
  selectedId: string | null;
  /** sessão encerrada: a pesquisa já foi copiada */
  locked: { name: string } | null;
}) {
  const t = useTranslations("session.survey");
  const [selected, setSelected] = useOptimistic(selectedId);
  const [pending, startTransition] = useTransition();
  const current = templates.find((tpl) => tpl.id === selected) ?? null;

  function choose(id: string) {
    if (id === selected) return;
    startTransition(async () => {
      setSelected(id);
      const result = await setSurveyTemplateAction(sessionId, id);
      if (!result.ok) toast.error(result.error);
      else toast.success(t("saved"));
    });
  }

  if (locked) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LockIcon aria-hidden className="shrink-0" /> {t("locked", { name: locked.name })}
        </p>
        {current ? <QuestionPreview template={current} /> : null}
      </div>
    );
  }

  const groups = [
    { id: "platform", label: t("platform"), items: templates.filter((tpl) => tpl.isPlatform) },
    { id: "mine", label: t("mine"), items: templates.filter((tpl) => !tpl.isPlatform) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-4" aria-busy={pending}>
        {groups.map((group) => (
          <fieldset key={group.id} className="flex flex-col gap-2">
            <legend className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.label}</legend>
            {group.items.map((tpl) => (
              <label
                key={tpl.id}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
              >
                <input
                  type="radio"
                  name="survey-template"
                  value={tpl.id}
                  checked={selected === tpl.id}
                  onChange={() => choose(tpl.id)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--primary)] max-md:size-5"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-medium">{tpl.name}</span>
                  <span className="text-xs text-muted-foreground">{t("questions", { count: tpl.questions.length })}</span>
                </span>
              </label>
            ))}
          </fieldset>
        ))}
        <p className="text-sm text-muted-foreground">
          {t("help")}{" "}
          <Link href="/dashboard/pesquisas" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline max-md:min-h-11">
            {t("manage")} <ChevronRightIcon aria-hidden width={12} height={12} />
          </Link>
        </p>
      </div>
      <div className={cn("lg:sticky lg:top-6", !current && "max-lg:hidden")}>
        {current ? <QuestionPreview template={current} /> : <p className="text-sm text-muted-foreground">{t("none")}</p>}
      </div>
    </div>
  );
}
