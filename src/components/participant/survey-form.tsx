"use client";

import { useActionState } from "react";
import { submitSurveyAction, type SurveyFormState } from "@/features/participant/actions";
import { answerFieldName, RANGE, TEXT_MAX_LENGTH, type SurveyQuestion } from "@/lib/domain/survey";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { CheckIcon } from "@/components/icons";

const initial: SurveyFormState = {};

const optionBox =
  "flex items-center justify-center rounded-lg border-2 font-semibold transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring";

function NumberScale({ question }: { question: SurveyQuestion }) {
  if (question.kind !== "scale" && question.kind !== "nps") return null;
  const { min, max } = RANGE[question.kind];
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="flex flex-col gap-1.5">
      <div className={question.kind === "nps" ? "grid grid-cols-6 gap-1.5" : "grid grid-cols-5 gap-2"}>
        {values.map((v) => (
          <label key={v} className="cursor-pointer">
            <input
              type="radio"
              name={answerFieldName(question.id)}
              value={v}
              required={question.required}
              className="peer sr-only"
            />
            <span className={`${optionBox} h-11 text-base`}>{v}</span>
          </label>
        ))}
      </div>
      {question.settings.minLabel || question.settings.maxLabel ? (
        <div className="flex justify-between gap-4 text-xs text-muted-foreground">
          <span>{question.settings.minLabel}</span>
          <span className="text-right">{question.settings.maxLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function Choice({ question }: { question: SurveyQuestion }) {
  return (
    <div className="flex flex-col gap-2">
      {(question.settings.options ?? []).map((option, index) => (
        <label key={option} className="cursor-pointer">
          <input
            type="radio"
            name={answerFieldName(question.id)}
            value={index}
            required={question.required}
            className="peer sr-only"
          />
          <span className={`${optionBox} min-h-12 px-4 py-2 text-left text-base`}>{option}</span>
        </label>
      ))}
    </div>
  );
}

export function SurveyForm({ sessionId, questions }: { sessionId: string; questions: SurveyQuestion[] }) {
  const [state, action, pending] = useActionState(submitSurveyAction.bind(null, sessionId), initial);

  if (state.done) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
          <CheckIcon width={28} height={28} />
        </span>
        <h2 className="text-2xl font-semibold">Obrigado!</h2>
        <p className="text-muted-foreground">Suas respostas foram enviadas e vão ajudar a próxima apresentação.</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-7">
      {questions.map((q) =>
        q.kind === "text" ? (
          <div key={q.id} className="flex flex-col gap-2">
            <label htmlFor={answerFieldName(q.id)} className="font-medium">
              {q.label}
              {q.required ? " *" : ""}
            </label>
            <Textarea id={answerFieldName(q.id)} name={answerFieldName(q.id)} maxLength={TEXT_MAX_LENGTH} required={q.required} />
          </div>
        ) : (
          <fieldset key={q.id} className="flex flex-col gap-3">
            <legend className="mb-3 font-medium">
              {q.label}
              {q.required ? " *" : ""}
            </legend>
            {q.kind === "choice" ? <Choice question={q} /> : <NumberScale question={q} />}
          </fieldset>
        ),
      )}

      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Enviando…" : "Enviar respostas"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {questions.some((q) => q.required) ? "* obrigatória · " : ""}Seu nome não aparece junto das suas respostas.
      </p>
    </form>
  );
}
