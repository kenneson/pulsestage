"use client";

import { useActionState } from "react";
import { submitFeedbackAction, type FeedbackFormState } from "@/features/participant/actions";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { CheckIcon } from "@/components/icons";

const initial: FeedbackFormState = {};

function Scale({ name, from, to, required, lowLabel, highLabel }: {
  name: string;
  from: number;
  to: number;
  required?: boolean;
  lowLabel: string;
  highLabel: string;
}) {
  const values = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return (
    <div className="flex flex-col gap-1.5">
      <div className={to - from > 5 ? "grid grid-cols-6 gap-1.5" : "grid grid-cols-5 gap-2"}>
        {values.map((v) => (
          <label key={v} className="cursor-pointer">
            <input type="radio" name={name} value={v} required={required} className="peer sr-only" />
            <span className="flex h-11 items-center justify-center rounded-lg border-2 text-base font-semibold transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              {v}
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

const DIMENSIONS = [
  { name: "clarity", label: "Clareza da apresentação" },
  { name: "engagement", label: "Engajamento" },
  { name: "content", label: "Qualidade do conteúdo" },
  { name: "applicability", label: "Aplicabilidade prática" },
] as const;

export function FeedbackForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState(submitFeedbackAction.bind(null, sessionId), initial);

  if (state.done) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
          <CheckIcon width={28} height={28} />
        </span>
        <h2 className="text-2xl font-semibold">Obrigado!</h2>
        <p className="text-muted-foreground">Sua avaliação foi enviada e vai ajudar a próxima apresentação.</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-7">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-medium">De 0 a 10, quanto esta sessão foi útil para você? *</legend>
        <Scale name="overall" from={0} to={10} required lowLabel="Nada útil" highLabel="Extremamente útil" />
      </fieldset>

      {DIMENSIONS.map((d) => (
        <fieldset key={d.name} className="flex flex-col gap-3">
          <legend className="mb-3 font-medium">{d.label}</legend>
          <Scale name={d.name} from={1} to={5} lowLabel="Muito ruim" highLabel="Excelente" />
        </fieldset>
      ))}

      <div className="flex flex-col gap-2">
        <Label htmlFor="mostValuable">O que foi mais valioso?</Label>
        <Textarea id="mostValuable" name="mostValuable" maxLength={1000} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="improvement">O que poderia melhorar?</Label>
        <Textarea id="improvement" name="improvement" maxLength={1000} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="comment">Comentário livre</Label>
        <Textarea id="comment" name="comment" maxLength={2000} />
      </div>

      {state.error ? <Alert>{state.error}</Alert> : null}
      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Enviando…" : "Enviar avaliação"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Seu nome não aparece junto da sua avaliação.</p>
    </form>
  );
}
