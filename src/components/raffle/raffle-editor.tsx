"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deletePrizeAction,
  movePrizeAction,
  saveRaffleSettingsAction,
  savePrizeAction,
} from "@/features/raffle/actions";
import type { RafflePrizeAdmin, RaffleState } from "@/lib/data/raffle";
import {
  MAX_PRIZE_QUANTITY,
  MAX_PRIZES,
  PRIZE_KIND_LABEL,
  prizeInputSchema,
  RAFFLE_ELIGIBILITIES,
  RAFFLE_ELIGIBILITY_META,
  type PrizeKind,
  type RaffleEligibility,
} from "@/lib/domain/raffle";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert, EmptyState } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ArrowDownIcon, ArrowUpIcon, EditIcon, GiftIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { WinnerList } from "./winner-list";

type PrizeDraft = { name: string; description: string; kind: PrizeKind; quantity: number; winnerMessage: string };

const EMPTY_PRIZE: PrizeDraft = { name: "", description: "", kind: "physical", quantity: 1, winnerMessage: "" };

function draftOf(prize: RafflePrizeAdmin): PrizeDraft {
  return {
    name: prize.name,
    description: prize.description ?? "",
    kind: prize.kind,
    quantity: prize.quantity,
    winnerMessage: prize.winnerMessage ?? "",
  };
}

function PrizeForm({
  sessionId,
  prizeId,
  initial,
  onDone,
}: {
  sessionId: string;
  prizeId: string | null;
  initial: PrizeDraft;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<PrizeDraft>) => setDraft((d) => ({ ...d, ...patch }));

  function save() {
    const check = prizeInputSchema.safeParse(draft);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Revise os campos.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await savePrizeAction(sessionId, prizeId, draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(prizeId ? "Prêmio atualizado." : "Prêmio cadastrado.");
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-background p-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem_8rem]">
        <Field>
          <Label htmlFor="prize-name">Prêmio</Label>
          <Input
            id="prize-name"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={120}
            placeholder="Livro autografado"
            autoFocus
          />
        </Field>
        <Field>
          <Label htmlFor="prize-kind">Tipo</Label>
          <Select id="prize-kind" value={draft.kind} onChange={(e) => set({ kind: e.target.value === "digital" ? "digital" : "physical" })}>
            <option value="physical">{PRIZE_KIND_LABEL.physical}</option>
            <option value="digital">{PRIZE_KIND_LABEL.digital}</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="prize-quantity">Ganhadores</Label>
          <Input
            id="prize-quantity"
            type="number"
            min={1}
            max={MAX_PRIZE_QUANTITY}
            value={draft.quantity}
            onChange={(e) => set({ quantity: Number(e.target.value) || 0 })}
          />
        </Field>
      </div>
      <Field>
        <Label htmlFor="prize-description">Descrição (opcional)</Label>
        <Input
          id="prize-description"
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          maxLength={300}
          placeholder="Aparece no telão junto com o prêmio"
        />
      </Field>
      <Field>
        <Label htmlFor="prize-message">Mensagem para quem ganhar (opcional)</Label>
        <Textarea
          id="prize-message"
          value={draft.winnerMessage}
          onChange={(e) => set({ winnerMessage: e.target.value })}
          maxLength={500}
          className="min-h-16"
          placeholder={
            draft.kind === "digital"
              ? "Código do cupom, link de resgate ou como receber"
              : "Onde e quando retirar o prêmio"
          }
        />
        <p className="text-xs text-muted-foreground">Aparece só no celular de quem ganhou, depois que o telão revela.</p>
      </Field>
      {error ? <Alert>{error}</Alert> : null}
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? "Salvando…" : "Salvar prêmio"}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/** Aba "Sorteio" da sessão: liga o sorteio, escolhe quem concorre e cadastra os prêmios. */
export function RaffleEditor({ sessionId, state }: { sessionId: string; state: RaffleState }) {
  const [confirm, confirmDialog] = useConfirm();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [eligibility, setOptimisticEligibility] = useOptimistic(state.eligibility);
  const enabled = eligibility !== null;

  const saveEligibility = (next: RaffleEligibility | null) =>
    startTransition(async () => {
      setOptimisticEligibility(next);
      const result = await saveRaffleSettingsAction(sessionId, { eligibility: next });
      if (!result.ok) toast.error(result.error);
    });

  const run = (task: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok && result.error) toast.error(result.error);
    });

  return (
    <div className="flex flex-col gap-6">
      {confirmDialog}
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={enabled}
          disabled={pending}
          onChange={(e) => saveEligibility(e.target.checked ? "survey" : null)}
        />
        <span>
          <span className="font-medium">Fazer sorteio nesta sessão</span>
          <span className="block text-sm text-muted-foreground">
            Cada pessoa que concorre recebe um número aleatório no celular. Na sala ao vivo, o card “Sorteio” leva o
            sorteio ao telão, com suspense e som, e mostra nome, número e avatar de quem ganhou.
          </span>
        </span>
      </label>

      {enabled ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Quem concorre</legend>
            {RAFFLE_ELIGIBILITIES.map((option) => (
              <label
                key={option}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3",
                  eligibility === option && "border-primary bg-primary/5",
                )}
              >
                <input
                  type="radio"
                  name="raffle-eligibility"
                  className="mt-1 size-4"
                  checked={eligibility === option}
                  disabled={pending}
                  onChange={() => saveEligibility(option)}
                />
                <span>
                  <span className="font-medium">{RAFFLE_ELIGIBILITY_META[option].label}</span>
                  <span className="block text-sm text-muted-foreground">{RAFFLE_ELIGIBILITY_META[option].description}</span>
                </span>
              </label>
            ))}
            <p className="text-sm text-muted-foreground">
              {plural(state.entrants, "pessoa concorrendo", "pessoas concorrendo")} agora
              {state.participants > 0 ? `, de ${plural(state.participants, "participante", "participantes")}` : ""}.
              {eligibility === "survey"
                ? " A pesquisa abre quando você encerra a sessão; a sala ao vivo continua aberta para o sorteio."
                : ""}
            </p>
          </fieldset>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">Prêmios</h3>
              {editing === null && state.prizes.length < MAX_PRIZES ? (
                <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
                  <PlusIcon /> Prêmio
                </Button>
              ) : null}
            </div>

            {state.prizes.length === 0 && editing !== "new" ? (
              <EmptyState
                title="Nenhum prêmio cadastrado"
                description="Cadastre o que será sorteado: um livro, uma mentoria, um cupom… Físico ou digital."
                action={
                  <Button size="sm" onClick={() => setEditing("new")}>
                    <GiftIcon /> Cadastrar prêmio
                  </Button>
                }
              />
            ) : null}

            <ol className="flex flex-col gap-3">
              {state.prizes.map((prize, index) =>
                editing === prize.id ? (
                  <li key={prize.id}>
                    <PrizeForm sessionId={sessionId} prizeId={prize.id} initial={draftOf(prize)} onDone={() => setEditing(null)} />
                  </li>
                ) : (
                  <li key={prize.id} className="flex flex-col gap-3 rounded-xl border p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="w-7 shrink-0 pt-0.5 font-script text-xl font-bold leading-none tabular-nums">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{PRIZE_KIND_LABEL[prize.kind]}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {prize.winners.filter((w) => !w.forfeitedAt).length} de {plural(prize.quantity, "ganhador", "ganhadores")}
                          </span>
                        </div>
                        <p className="mt-1 font-medium">{prize.name}</p>
                        {prize.description ? <p className="text-sm text-muted-foreground">{prize.description}</p> : null}
                        {prize.winnerMessage ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Mensagem para quem ganhar: <span className="text-foreground">{prize.winnerMessage}</span>
                          </p>
                        ) : null}
                      </div>
                      <div className="flex">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Subir"
                          disabled={pending || index === 0}
                          onClick={() => run(() => movePrizeAction(sessionId, prize.id, -1))}
                        >
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Descer"
                          disabled={pending || index === state.prizes.length - 1}
                          onClick={() => run(() => movePrizeAction(sessionId, prize.id, 1))}
                        >
                          <ArrowDownIcon />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(prize.id)}>
                          <EditIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Excluir"
                          disabled={pending}
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Excluir o prêmio?",
                              description:
                                prize.winners.length > 0
                                  ? "Os ganhadores já sorteados para ele também saem da lista."
                                  : undefined,
                              confirmLabel: "Excluir",
                              destructive: true,
                            });
                            if (ok) run(() => deletePrizeAction(sessionId, prize.id));
                          }}
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    </div>
                    <WinnerList winners={prize.winners} />
                  </li>
                ),
              )}
              {editing === "new" ? (
                <li>
                  <PrizeForm sessionId={sessionId} prizeId={null} initial={EMPTY_PRIZE} onDone={() => setEditing(null)} />
                </li>
              ) : null}
            </ol>
          </section>

          <p className="text-xs text-muted-foreground">
            Cada pessoa ganha no máximo um prêmio. O sorteio é feito no servidor, com gerador aleatório criptográfico,
            antes de o telão começar a animação. Sorteios promocionais feitos por empresas podem exigir autorização
            prévia (Lei 5.768/1971); confira antes de divulgar.
          </p>
        </>
      ) : null}
    </div>
  );
}
