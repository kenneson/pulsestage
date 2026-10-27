"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { deleteSessionAction, setSessionStatusAction, startRehearsalAction } from "@/features/sessions/actions";
import { duplicateSessionAction } from "@/features/library/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { Field, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { CopyIcon, DownloadIcon, MonitorIcon, MoreIcon, PlayIcon, TrashIcon } from "@/components/icons";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { useQrDownload } from "./qr-download-button";

export function StartSessionButton({
  sessionId,
  hasInteractions,
  className,
}: {
  sessionId: string;
  hasInteractions: boolean;
  className?: string;
}) {
  const t = useTranslations("session.controls");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
      {confirmDialog}
      <Button
        disabled={pending}
        className={className}
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
export function RehearsalButton({ sessionId, className }: { sessionId: string; className?: string }) {
  const t = useTranslations("session.controls");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        variant="outline"
        disabled={pending}
        className={className}
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

/** Excluir a sessão com confirmação; `run` abre a confirmação. Usado pelo botão e pelo menu "⋯". */
function useDeleteSession(sessionId: string, title: string) {
  const t = useTranslations("session.controls");
  const tActions = useTranslations("common.actions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  async function run() {
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
  }
  return { run, pending, confirmDialog };
}

export function DeleteSessionButton({
  sessionId,
  title,
  className,
}: {
  sessionId: string;
  title: string;
  className?: string;
}) {
  const tActions = useTranslations("common.actions");
  const { run, pending, confirmDialog } = useDeleteSession(sessionId, title);
  return (
    <>
      {confirmDialog}
      <Button
        variant="ghost"
        disabled={pending}
        className={cn("text-destructive hover:text-destructive", className)}
        onClick={run}
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
/** Janela "Duplicar" (nome e data da cópia); `open` abre. Usada pelo botão e pelo menu "⋯". */
function useDuplicateDialog(sessionId: string, title: string) {
  const t = useTranslations("session.controls");
  const tActions = useTranslations("common.actions");
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaultTitle = t("copyTitle", { title }).slice(0, 200);
  function open() {
    setError(null);
    ref.current?.showModal();
  }
  const dialog = (
    <dialog
      ref={ref}
      aria-labelledby={`duplicate-${sessionId}`}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-card p-6 text-left max-md:p-5 text-card-foreground shadow-lg backdrop:bg-black/50"
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
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
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
        <div className="flex justify-end gap-2 max-md:grid max-md:grid-cols-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => ref.current?.close()} className="max-md:h-11">
            {tActions("cancel")}
          </Button>
          <Button type="submit" disabled={pending} className="max-md:h-auto max-md:min-h-11 max-md:whitespace-normal">
            {pending ? t("duplicating") : t("duplicateAndEdit")}
          </Button>
        </div>
      </form>
    </dialog>
  );
  return { open, dialog };
}

export function DuplicateSessionButton({
  sessionId,
  title,
  size = "default",
  iconOnly = false,
  className,
}: {
  sessionId: string;
  title: string;
  size?: "default" | "sm";
  /** só o ícone (linhas da lista de sessões) */
  iconOnly?: boolean;
  className?: string;
}) {
  const t = useTranslations("session.controls");
  const tActions = useTranslations("common.actions");
  const { open, dialog } = useDuplicateDialog(sessionId, title);

  return (
    <>
      <Button
        variant={iconOnly ? "ghost" : "outline"}
        size={iconOnly ? "icon" : size}
        className={className}
        aria-label={iconOnly ? t("duplicateAria", { title }) : undefined}
        title={iconOnly ? tActions("duplicate") : undefined}
        onClick={open}
      >
        <CopyIcon />
        {iconOnly ? null : ` ${tActions("duplicate")}`}
      </Button>
      {dialog}
    </>
  );
}

/**
 * Ações de menos uso da sessão (baixar QR Code, duplicar, excluir) num menu "⋯", para o topo da página
 * mostrar só o que se usa sempre.
 */
export function SessionMoreMenu({
  sessionId,
  title,
  qr,
  className,
}: {
  sessionId: string;
  title: string;
  /** sem QR Code depois de encerrada */
  qr: { joinUrl: string; code: string } | null;
  className?: string;
}) {
  const t = useTranslations("session.controls");
  const tActions = useTranslations("common.actions");
  const tQr = useTranslations("session.qr");
  const duplicate = useDuplicateDialog(sessionId, title);
  const remove = useDeleteSession(sessionId, title);
  const qrDownload = useQrDownload(qr?.joinUrl ?? "", qr?.code ?? "");
  const items: MenuItem[] = [
    ...(qr ? [{ label: tQr("download"), icon: <DownloadIcon />, onSelect: qrDownload.download }] : []),
    { label: tActions("duplicate"), icon: <CopyIcon />, onSelect: duplicate.open },
    { label: tActions("delete"), icon: <TrashIcon />, onSelect: remove.run, destructive: true, disabled: remove.pending },
  ];
  return (
    <>
      {qr ? qrDownload.canvas : null}
      {duplicate.dialog}
      {remove.confirmDialog}
      <Menu
        label={t("moreActions")}
        trigger={
          <>
            <MoreIcon /> <span className="md:sr-only">{t("more")}</span>
          </>
        }
        items={items}
        className={className}
        triggerClassName="w-full md:w-auto md:px-2.5"
      />
    </>
  );
}
