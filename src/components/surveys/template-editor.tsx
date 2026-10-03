"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveSurveyTemplateAction } from "@/features/surveys/actions";
import {
  DIMENSION_LABEL,
  DIMENSIONS,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  QUESTION_KIND_META,
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

// Chaves só para a lista do React (não vão para o DOM nem para o servidor).
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [questions, setQuestions] = useState<EditorQuestion[]>(() =>
    initial.questions.map((q) => ({ ...q, key: nextKey() })),
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
      toast.success("Modelo salvo.");
      router.push("/dashboard/pesquisas");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="grid gap-4">
          <Field>
            <Label htmlFor="template-name">Nome do modelo</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Ex.: Pesquisa da aula de Marketing"
            />
          </Field>
          <Field>
            <Label htmlFor="template-description">Descrição (opcional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Para que serve esta pesquisa."
            />
          </Field>
        </CardContent>
      </Card>

      <ol className="flex flex-col gap-4">
        {questions.map((q, index) => (
          <li key={q.key}>
            <Card>
              <CardContent className="grid gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-script text-xl font-bold tabular-nums">{index + 1}</span>
                  <Select
                    aria-label="Tipo da pergunta"
                    value={q.kind}
                    onChange={(e) => {
                      const kind = e.target.value;
                      if (isQuestionKind(kind) && kind !== q.kind) update(q.key, blank(kind, q.label, q.required));
                    }}
                    className="w-auto"
                  >
                    {QUESTION_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {QUESTION_KIND_META[kind].label}
                      </option>
                    ))}
                  </Select>
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon" aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Descer"
                      disabled={index === questions.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDownIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover pergunta"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setQuestions((list) => list.filter((x) => x.key !== q.key))}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </div>

                <Field>
                  <Label htmlFor={`${q.key}-label`}>Pergunta</Label>
                  <Input
                    id={`${q.key}-label`}
                    value={q.label}
                    onChange={(e) => update(q.key, { ...q, label: e.target.value })}
                    maxLength={300}
                    placeholder="O que você quer perguntar à plateia?"
                  />
                </Field>

                {q.kind === "scale" || q.kind === "nps" ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field>
                      <Label htmlFor={`${q.key}-dimension`}>Dimensão</Label>
                      <Select
                        id={`${q.key}-dimension`}
                        value={q.dimension ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          update(q.key, { ...q, dimension: isDimension(value) ? value : null });
                        }}
                      >
                        <option value="">Nenhuma</option>
                        {DIMENSIONS.map((d) => (
                          <option key={d} value={d}>
                            {DIMENSION_LABEL[d]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field>
                      <Label htmlFor={`${q.key}-min`}>Rótulo do {q.kind === "scale" ? "1" : "0"}</Label>
                      <Input
                        id={`${q.key}-min`}
                        value={q.minLabel ?? ""}
                        onChange={(e) => update(q.key, { ...q, minLabel: e.target.value })}
                        maxLength={40}
                        placeholder="Ex.: Nada"
                      />
                    </Field>
                    <Field>
                      <Label htmlFor={`${q.key}-max`}>Rótulo do {q.kind === "scale" ? "5" : "10"}</Label>
                      <Input
                        id={`${q.key}-max`}
                        value={q.maxLabel ?? ""}
                        onChange={(e) => update(q.key, { ...q, maxLabel: e.target.value })}
                        maxLength={40}
                        placeholder="Ex.: Totalmente"
                      />
                    </Field>
                    <p className="text-xs text-muted-foreground sm:col-span-3">
                      A dimensão agrupa perguntas parecidas no scorecard, nos pontos fortes e fracos e na evolução entre
                      sessões.
                    </p>
                  </div>
                ) : null}

                {q.kind === "choice" ? (
                  <div className="flex flex-col gap-2">
                    <Label>Alternativas</Label>
                    {q.options.map((option, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          aria-label={`Alternativa ${i + 1}`}
                          value={option}
                          maxLength={80}
                          placeholder={`Alternativa ${i + 1}`}
                          onChange={(e) =>
                            update(q.key, { ...q, options: q.options.map((o, j) => (j === i ? e.target.value : o)) })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover alternativa ${i + 1}`}
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
                        className="w-fit"
                        onClick={() => update(q.key, { ...q, options: [...q.options, ""] })}
                      >
                        <PlusIcon /> Adicionar alternativa
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => update(q.key, { ...q, required: e.target.checked })}
                    className="size-4"
                  />
                  Resposta obrigatória
                </label>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      {questions.length < MAX_QUESTIONS ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <PlusIcon /> Adicionar pergunta
          </p>
          <div className="flex flex-wrap gap-2">
            {QUESTION_KINDS.map((kind) => (
              <Button
                key={kind}
                variant="outline"
                size="sm"
                title={QUESTION_KIND_META[kind].description}
                onClick={() => setQuestions((list) => [...list, { ...blank(kind), key: nextKey() }])}
              >
                {QUESTION_KIND_META[kind].label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={save} disabled={pending}>
          {pending ? "Salvando…" : "Salvar modelo"}
        </Button>
        <Button size="lg" variant="outline" onClick={() => router.push("/dashboard/pesquisas")} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
