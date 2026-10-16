"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteSessionAction, setSessionStatusAction, startRehearsalAction } from "@/features/sessions/actions";
import { duplicateSessionAction } from "@/features/library/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { CopyIcon, MonitorIcon, PlayIcon, TrashIcon } from "@/components/icons";

export function StartSessionButton({ sessionId, hasInteractions }: { sessionId: string; hasInteractions: boolean }) {
  const t = useTranslations("session.controls");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
      {confirmDialog}
      <Button
        disabled={pending}
        onClick={async () => {
          if (
            !hasInteractions &&
            !(await confirm({
              title: t("startConfirmTitle"),
              description: t("startConfirmDescription"),
              confirmLabel: t("startConfirmLabel"),
            }))
          ) {
            return;
          }
          startTransition(async () => {
            const result = await setSessionStatusAction(sessionId, "live");
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            router.push(`/dashboard/sessions/${sessionId}/live`);
          });
        }}
      >
        <PlayIcon /> {pending ? t("starting") : t("start")}
      </Button>
    </>
  );
}

/**
 * "Testar sessão": abre um ensaio ao vivo (cópia oculta da sessão) para conferir telão e celular.
 * Nada do ensaio conta nas estatísticas; a sessão original continua como está.
 */
export function RehearsalButton({ sessionId }: { sessionId: string }) {
  const t = useTranslations("session.controls");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="outline"
        disabled={pending}
        title={t("rehearsalHint")}
        aria-describedby={`rehearsal-hint-${sessionId}`}
        onClick={() =>
          startTransition(async () => {
            const result = await startRehearsalAction(sessionId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            router.push(`/dashboard/sessions/${result.data.id}/live`);
          })
        }
      >
        <MonitorIcon /> {pending ? t("rehearsalStarting") : t("rehearsal")}
      </Button>
      {/* Fora do botão: descreve sem entrar no nome acessível. */}
      <span id={`rehearsal-hint-${sessionId}`} className="sr-only">
        {t("rehearsalHint")}
      </span>
    </>
  );
}

export function DeleteSessionButton({ sessionId, title }: { sessionId: string; title: string }) {
  const t = useTranslations("session.controls");
  const tActions = useTranslations("common.actions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
      {confirmDialog}
      <Button
        variant="ghost"
        disabled={pending}
        className="text-destructive hover:text-destructive"
        onClick={async () => {
          const confirmed = await confirm({
            title: t("deleteConfirmTitle", { title }),
            description: t("deleteConfirmDescription"),
            confirmLabel: tActions("delete"),
            destructive: true,
          });
          if (!confirmed) return;
          startTransition(async () => {
            const result = await deleteSessionAction(sessionId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(t("deleted"));
            router.push("/dashboard/sessions");
          });
        }}
      >
        <TrashIcon /> {tActions("delete")}
      </Button>
    </>
  );
}

/**
 * "Duplicar": abre uma janela com o nome e a data da nova sessão. A cópia nasce em rascunho, com perguntas,
 * slides, pesquisa e prêmios do sorteio; respostas e participantes ficam na original.
 */
export function DuplicateSessionButton({
  sessionId,
  title,
  size = "default",
  iconOnly = false,
}: {
  sessionId: string;
  title: string;
  size?: "default" | "sm";
  /** só o ícone (linhas da lista de sessões) */
  iconOnly?: boolean;
}) {
  const t = useTranslations("session.controls");
  const tActions = useTranslations("common.actions");
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaultTitle = t("copyTitle", { title }).slice(0, 200);

  return (
    <>
      <Button
        variant={iconOnly ? "ghost" : "outline"}
        size={iconOnly ? "icon" : size}
        aria-label={iconOnly ? t("duplicateAria", { title }) : undefined}
        title={iconOnly ? tActions("duplicate") : undefined}
        onClick={() => {
          setError(null);
          ref.current?.showModal();
        }}
      >
        <CopyIcon />
        {iconOnly ? null : ` ${tActions("duplicate")}`}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={`duplicate-${sessionId}`}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-card p-6 text-left text-card-foreground shadow-lg backdrop:bg-black/50"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const value = (key: string) => {
              const v = data.get(key);
              return typeof v === "string" ? v.trim() : "";
            };
            startTransition(async () => {
              // Em caso de sucesso a action redireciona para a cópia, pronta para editar.
              const result = await duplicateSessionAction(sessionId, {
                title: value("title") || undefined,
                date: value("date"),
                time: value("time"),
              });
              if (!result.ok) setError(result.error);
            });
          }}
        >
          <div className="flex flex-col gap-1">
            <h2 id={`duplicate-${sessionId}`} className="text-lg font-semibold">
              {t("duplicateTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("duplicateDescription")}</p>
          </div>
          <Field>
            <Label htmlFor={`duplicate-title-${sessionId}`}>{t("newName")}</Label>
            <Input id={`duplicate-title-${sessionId}`} name="title" defaultValue={defaultTitle} maxLength={200} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label htmlFor={`duplicate-date-${sessionId}`}>{t("dateOptional")}</Label>
              <Input id={`duplicate-date-${sessionId}`} name="date" type="date" />
            </Field>
            <Field>
              <Label htmlFor={`duplicate-time-${sessionId}`}>{t("time")}</Label>
              <Input id={`duplicate-time-${sessionId}`} name="time" type="time" />
            </Field>
          </div>
          {error ? <Alert>{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => ref.current?.close()}>
              {tActions("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("duplicating") : t("duplicateAndEdit")}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
