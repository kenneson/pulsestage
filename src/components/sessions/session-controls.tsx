"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSessionAction, setSessionStatusAction } from "@/features/sessions/actions";
import { Button } from "@/components/ui/button";
import { PlayIcon, TrashIcon } from "@/components/icons";

export function StartSessionButton({ sessionId, hasInteractions }: { sessionId: string; hasInteractions: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() => {
        if (!hasInteractions && !window.confirm("A sessão não tem interações. Iniciar mesmo assim?")) return;
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
  );
}

export function DeleteSessionButton({ sessionId, title }: { sessionId: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      className="text-destructive hover:text-destructive"
      onClick={() => {
        if (!window.confirm(`Excluir "${title}" e todos os dados (respostas, feedback, insights)? Não dá para desfazer.`)) return;
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
  );
}
