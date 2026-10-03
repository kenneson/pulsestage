"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSessionAction, setSessionStatusAction } from "@/features/sessions/actions";
import { duplicateSessionAction } from "@/features/library/actions";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
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

export function DuplicateSessionButton({ sessionId, size = "default" }: { sessionId: string; size?: "default" | "sm" }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size={size}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // Em caso de sucesso a action redireciona para a cópia.
          const result = await duplicateSessionAction(sessionId);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      <CopyIcon /> {pending ? "Duplicando…" : "Duplicar"}
    </Button>
  );
}
