"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveSurveyTemplateAction } from "@/features/surveys/actions";
import {
  DIMENSIONS,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  QUESTION_KINDS,
  isDimension,
  isQuestionKind,
  type QuestionDraft,
  type QuestionKind,
  type TemplateDraft,
} from "@/lib/domain/survey";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from "@/components/icons";

type EditorQuestion = QuestionDraft & { key: string };

// Chaves da lista do React; também viram ids dos campos (htmlFor/id). As iniciais são fixas pela posição
// (iguais no servidor e no navegador, sem erro de hidratação); as novas, criadas só no navegador, usam o contador.
let seq = 0;
const nextKey = () => `q${++seq}`;

/** Pergunta vazia de um tipo, aproveitando texto e obrigatoriedade ao trocar de tipo. */
function blank(kind: QuestionKind, label = "", required = false): QuestionDraft {
  switch (kind) {
    case "scale":
    case "nps":
      return { kind, label, required, dimension: null, minLabel: "", maxLabel: "" };
    case "choice":
      return { kind, label, required, options: ["", ""] };
    case "text":
      return { kind, label, required };
  }
}

export function TemplateEditor({ templateId, initial }: { templateId: string | null; initial: TemplateDraft }) {
  const t = useTranslations("surveys.editor");
  const tDomain = useTranslations("domain");
  const tCommon = useTranslations("common.actions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [questions, setQuestions] = useState<EditorQuestion[]>(() =>
    initial.questions.map((q, index) => ({ ...q, key: `q-initial-${index}` })),
  );
  const [error, setError] = useState<string | null>(null);

  function update(key: string, next: QuestionDraft) {
    setQuestions((list) => list.map((q) => (q.key === key ? { ...next, key } : q)));
  }

  function move(index: number, delta: number) {
    setQuestions((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      const [item] = copy.splice(index, 1);
      if (item) copy.splice(target, 0, item);
      return copy;
    });
  }

  function save() {
    setError(null);
    const payload = JSON.stringify({
      name,
      description,
      // A chave da lista é só do editor: o servidor valida o rascunho com Zod e ignora campos extras.
      questions,
    });
    startTransition(async () => {
      const result = await saveSurveyTemplateAction(templateId, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(t("saved"));
      router.push("/dashboard/pesquisas");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4">
          <Field>
            <Label htmlFor="template-name">{t("name")}</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder={t("namePlaceholder")}
            />
          </Field>
          <Field>
            <Label htmlFor="template-description">{t("description")}</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder={t("descriptionPlaceholder")}
            />
          </Field>
        </CardContent>
      </Card>

      <ol className="flex flex-col gap-4">
        {questions.map((q, index) => (
          <li key={q.key}>
            <Card>
              <CardContent className="grid gap-4 max-md:grid-cols-1">
                <div className="flex flex-wrap items-center gap-3 max-md:flex-nowrap max-md:gap-2">
                  <span className="font-display text-xl font-bold tabular-nums">{index + 1}</span>
                  <Select
                    aria-label={t("kind")}
                    value={q.kind}
                    onChange={(e) => {
                      const kind = e.target.value;
                      if (isQuestionKind(kind) && kind !== q.kind) update(q.key, blank(kind, q.label, q.required));
                    }}
                    className="w-auto max-md:min-w-0 max-md:flex-1"
                  >
                    {QUESTION_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {tDomain(`surveyKinds.${kind}.label`)}
                      </option>
                    ))}
                  </Select>
                  <div className="ml-auto flex gap-1 max-md:-mr-2 max-md:gap-0 max-md:[&>button]:size-11">
                    <Button variant="ghost" size="icon" aria-label={t("moveUp")} disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("moveDown")}
                      disabled={index === questions.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("removeQuestion")}
                      className="text-destructive hover:text-destructive"
                      onClick={() => setQuestions((list) => list.filter((x) => x.key !== q.key))}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </div>

                <Field>
                  <Label htmlFor={`${q.key}-label`}>{t("question")}</Label>
                  <Input
                    id={`${q.key}-label`}
                    value={q.label}
                    onChange={(e) => update(q.key, { ...q, label: e.target.value })}
                    maxLength={300}
                    placeholder={t("questionPlaceholder")}
                  />
                </Field>

                {q.kind === "scale" || q.kind === "nps" ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field>
                      <Label htmlFor={`${q.key}-dimension`}>{t("dimension")}</Label>
                      <Select
                        id={`${q.key}-dimension`}
                        value={q.dimension ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          update(q.key, { ...q, dimension: isDimension(value) ? value : null });
                        }}
                      >
                        <option value="">{t("noDimension")}</option>
                        {DIMENSIONS.map((d) => (
                          <option key={d} value={d}>
                            {tDomain(`dimensions.${d}`)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field>
                      <Label htmlFor={`${q.key}-min`}>{t("endLabel", { value: q.kind === "scale" ? "1" : "0" })}</Label>
                      <Input
                        id={`${q.key}-min`}
                        value={q.minLabel ?? ""}
                        onChange={(e) => update(q.key, { ...q, minLabel: e.target.value })}
                        maxLength={40}
                        placeholder={t("minPlaceholder")}
                      />
                    </Field>
                    <Field>
                      <Label htmlFor={`${q.key}-max`}>{t("endLabel", { value: q.kind === "scale" ? "5" : "10" })}</Label>
                      <Input
                        id={`${q.key}-max`}
                        value={q.maxLabel ?? ""}
                        onChange={(e) => update(q.key, { ...q, maxLabel: e.target.value })}
                        maxLength={40}
                        placeholder={t("maxPlaceholder")}
                      />
                    </Field>
                    <p className="text-xs text-muted-foreground sm:col-span-3">{t("dimensionHint")}</p>
                  </div>
                ) : null}

                {q.kind === "choice" ? (
                  <div className="flex flex-col gap-2">
                    <Label>{t("options")}</Label>
                    {q.options.map((option, i) => (
                      <div key={i} className="flex gap-2 max-md:[&>button]:size-11">
                        <Input
                          aria-label={t("option", { number: i + 1 })}
                          value={option}
                          maxLength={80}
                          placeholder={t("option", { number: i + 1 })}
                          onChange={(e) =>
                            update(q.key, { ...q, options: q.options.map((o, j) => (j === i ? e.target.value : o)) })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("removeOption", { number: i + 1 })}
                          disabled={q.options.length <= 2}
                          onClick={() => update(q.key, { ...q, options: q.options.filter((_, j) => j !== i) })}
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    ))}
                    {q.options.length < MAX_OPTIONS ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-fit max-md:h-11 max-md:text-sm"
                        onClick={() => update(q.key, { ...q, options: [...q.options, ""] })}
                      >
                        <PlusIcon /> {t("addOption")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <label className="flex items-center gap-2 text-sm max-md:-my-2 max-md:min-h-11">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => update(q.key, { ...q, required: e.target.checked })}
                    className="size-4"
                  />
                  {t("required")}
                </label>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      {questions.length < MAX_QUESTIONS ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <PlusIcon /> {t("addQuestion")}
          </p>
          <div className="flex flex-wrap gap-2 max-md:grid max-md:grid-cols-2 max-md:[&>button]:h-11 max-md:[&>button]:text-sm">
            {QUESTION_KINDS.map((kind) => (
              <Button
                key={kind}
                variant="outline"
                size="sm"
                title={tDomain(`surveyKinds.${kind}.description`)}
                onClick={() => setQuestions((list) => [...list, { ...blank(kind), key: nextKey() }])}
              >
                {tDomain(`surveyKinds.${kind}.label`)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap gap-3 max-md:grid max-md:grid-cols-2">
        <Button size="lg" onClick={save} disabled={pending}>
          {pending ? tCommon("saving") : t("save")}
        </Button>
        <Button size="lg" variant="outline" onClick={() => router.push("/dashboard/pesquisas")} disabled={pending}>
          {tCommon("cancel")}
        </Button>
      </div>
    </div>
  );
}
