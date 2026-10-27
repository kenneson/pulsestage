"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  addTeamAction,
  deleteTeamAction,
  reorderTeamsAction,
  setTeamsEnabledAction,
  updateTeamAction,
} from "@/features/teams/actions";
import type { TeamsState, TeamView } from "@/features/teams/data";
import { canAddTeam, canRemoveTeam, moveTeam, TEAM_COLORS, TEAM_NAME_MAX } from "@/lib/domain/team-settings";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { shapeBg, ShapeGlyph } from "@/components/option-shape";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon, UsersIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Cor da equipe = forma e cor da alternativa na mesma posição (a forma acompanha a cor, para daltônicos). */
function TeamColor({ color, className }: { color: number; className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-white", shapeBg(color - 1), className)}>
      <ShapeGlyph index={color - 1} className="size-4" />
    </span>
  );
}

function TeamRow({
  team,
  index,
  total,
  canRemove,
  disabled,
  run,
  sessionId,
  order,
}: {
  team: TeamView;
  index: number;
  total: number;
  canRemove: boolean;
  disabled: boolean;
  run: (task: () => Promise<ActionResult<TeamsState>>) => void;
  sessionId: string;
  order: string[];
}) {
  const t = useTranslations("session.teams");
  const tColors = useTranslations("session.teams.colors");
  const [name, setName] = useState(team.name);
  const [picking, setPicking] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  // Nome salvo no servidor mudou (outra aba, ou o servidor aparou espaços): acompanha.
  const [savedName, setSavedName] = useState(team.name);
  if (savedName !== team.name) {
    setSavedName(team.name);
    setName(team.name);
  }

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed === team.name) return;
    if (!trimmed) {
      setName(team.name);
      return;
    }
    run(() => updateTeamAction(sessionId, team.id, { name: trimmed }));
  };

  const remove = async () => {
    if (team.members > 0) {
      const ok = await confirm({
        title: t("deleteTitle", { name: team.name }),
        description: t("deleteDescription", { count: team.members }),
        confirmLabel: t("delete"),
        destructive: true,
      });
      if (!ok) return;
    }
    run(() => deleteTeamAction(sessionId, team.id));
  };

  return (
    <li className="flex flex-col gap-2 rounded-md border p-2 md:p-2.5">
      {confirmDialog}
      <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPicking((v) => !v)}
          aria-expanded={picking}
          aria-label={t("colorLabel", { name: team.name, color: tColors(String(team.color) as "1") })}
          className="flex size-11 shrink-0 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:size-9"
        >
          <TeamColor color={team.color} className="md:size-7" />
        </button>
        <Input
          value={name}
          maxLength={TEAM_NAME_MAX}
          disabled={disabled}
          aria-label={t("nameLabel", { number: index + 1 })}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") setName(team.name);
          }}
          className="min-w-0 flex-1 basis-40 md:h-9"
        />
        <div className="flex w-full items-center gap-1 md:w-auto">
          <span className="mr-auto inline-flex items-center gap-1.5 pl-1 text-xs text-muted-foreground md:mr-2 md:min-w-20 md:justify-end">
            <UsersIcon className="size-3.5" /> {t("members", { count: team.members })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled || index === 0}
            aria-label={t("moveUp", { name: team.name })}
            onClick={() => run(() => reorderTeamsAction(sessionId, moveTeam(order, team.id, -1)))}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled || index === total - 1}
            aria-label={t("moveDown", { name: team.name })}
            onClick={() => run(() => reorderTeamsAction(sessionId, moveTeam(order, team.id, 1)))}
          >
            <ArrowDownIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled || !canRemove}
            aria-label={t("deleteLabel", { name: team.name })}
            title={canRemove ? undefined : t("minHint")}
            onClick={remove}
            className="text-muted-foreground hover:text-destructive"
          >
            <TrashIcon />
          </Button>
        </div>
      </div>
      {picking ? (
        <div role="radiogroup" aria-label={t("colorPicker", { name: team.name })} className="grid grid-cols-4 gap-1 sm:grid-cols-8">
          {TEAM_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={team.color === color}
              aria-label={tColors(String(color) as "1")}
              disabled={disabled}
              onClick={() => {
                setPicking(false);
                if (color !== team.color) run(() => updateTeamAction(sessionId, team.id, { color }));
              }}
              className={cn(
                "flex h-11 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:h-10",
                team.color === color && "bg-accent ring-2 ring-foreground/70",
              )}
            >
              <TeamColor color={color} />
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Cartão "Equipes" da aba Participação: ligar/desligar, nomes, cores, ordem e exclusão.
 * Salva na hora (também com a sessão ao vivo); sessão encerrada fica só para leitura.
 */
export function TeamsSettings({
  sessionId,
  initial,
  status,
  className,
}: {
  sessionId: string;
  initial: TeamsState;
  /** status da sessão: "draft" | "live" | "paused" | "completed" */
  status: string;
  className?: string;
}) {
  const t = useTranslations("session.teams");
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const readOnly = status === "completed";
  const busy = pending || readOnly;

  const run = (task: () => Promise<ActionResult<TeamsState>>) =>
    startTransition(async () => {
      const result = await task();
      if (!result.ok) toast.error(result.error);
      else setState(result.data);
    });

  const order = state.teams.map((x) => x.id);
  const removable = canRemoveTeam(state.teams.length, state.enabled);
  const withoutTeam = status !== "draft" && state.enabled;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className={cn("flex cursor-pointer items-start gap-3 max-md:min-h-11", readOnly && "cursor-not-allowed opacity-60")}>
          <input
            type="checkbox"
            checked={state.enabled}
            disabled={busy}
            onChange={(e) => {
              const enabled = e.target.checked;
              setState((s) => ({ ...s, enabled }));
              run(() => setTeamsEnabledAction(sessionId, enabled));
            }}
            className="mt-0.5 size-4 shrink-0 accent-primary max-md:size-5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{t("enable")}</span>
            <span className="text-xs text-muted-foreground">{t("enableDescription")}</span>
          </span>
        </label>

        {state.enabled ? (
          <>
            {withoutTeam ? <p className="rounded-md bg-standby/15 px-3 py-2 text-xs text-foreground">{t("liveHint")}</p> : null}
            <ul className="flex flex-col gap-2" aria-label={t("listLabel")}>
              {state.teams.map((team, index) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  index={index}
                  total={state.teams.length}
                  canRemove={removable}
                  disabled={busy}
                  run={run}
                  sessionId={sessionId}
                  order={order}
                />
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                disabled={busy || !canAddTeam(state.teams.length)}
                onClick={() => run(() => addTeamAction(sessionId))}
                className="max-md:w-full"
              >
                <PlusIcon /> {t("add")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("limits")}</p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
