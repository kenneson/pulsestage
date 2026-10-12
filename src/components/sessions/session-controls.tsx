"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSessionAction, setSessionStatusAction } from "@/features/sessions/actions";
import { duplicateSessionAction } from "@/features/library/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { CopyIcon, PlayIcon, TrashIcon } from "@/components/icons";

export function StartSessionButton({ sessionId, hasInteractions }: { sessionId: string; hasInteractions: boolean }) {
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
              title: "Iniciar sem interações?",
              description: "A sessão ainda não tem nenhuma interação.",
              confirmLabel: "Iniciar mesmo assim",
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
        <PlayIcon /> {pending ? "Iniciando…" : "Iniciar sessão"}
      </Button>
    </>
  );
}

export function DeleteSessionButton({ sessionId, title }: { sessionId: string; title: string }) {
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
            title: `Excluir "${title}"?`,
            description: "Todos os dados da sessão (respostas, feedback, insights) serão apagados. Não dá para desfazer.",
            confirmLabel: "Excluir",
            destructive: true,
          });
          if (!confirmed) return;
          startTransition(async () => {
            const result = await deleteSessionAction(sessionId);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Sessão excluída.");
            router.push("/dashboard/sessions");
          });
        }}
      >
        <TrashIcon /> Excluir
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
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaultTitle = `${title} (cópia)`.slice(0, 200);

  return (
    <>
      <Button
        variant={iconOnly ? "ghost" : "outline"}
        size={iconOnly ? "icon" : size}
        aria-label={iconOnly ? `Duplicar ${title}` : undefined}
        title={iconOnly ? "Duplicar" : undefined}
        onClick={() => {
          setError(null);
          ref.current?.showModal();
        }}
      >
        <CopyIcon />
        {iconOnly ? null : " Duplicar"}
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
              Duplicar sessão
            </h2>
            <p className="text-sm text-muted-foreground">
              A cópia leva perguntas, slides, pesquisa e prêmios do sorteio. Respostas e participantes ficam na original.
            </p>
          </div>
          <Field>
            <Label htmlFor={`duplicate-title-${sessionId}`}>Nome da nova sessão</Label>
            <Input id={`duplicate-title-${sessionId}`} name="title" defaultValue={defaultTitle} maxLength={200} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label htmlFor={`duplicate-date-${sessionId}`}>Data (opcional)</Label>
              <Input id={`duplicate-date-${sessionId}`} name="date" type="date" />
            </Field>
            <Field>
              <Label htmlFor={`duplicate-time-${sessionId}`}>Horário</Label>
              <Input id={`duplicate-time-${sessionId}`} name="time" type="time" />
            </Field>
          </div>
          {error ? <Alert>{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => ref.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Duplicando…" : "Duplicar e editar"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
