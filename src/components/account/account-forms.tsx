"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  changePasswordAction,
  deleteAccountAction,
  removeAvatarAction,
  signOutOthersAction,
  updatePreferencesAction,
  updateProfileAction,
  uploadAvatarAction,
  type AccountFormState,
} from "@/features/account/actions";
import { TIME_ZONE_OPTIONS } from "@/lib/datetime";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ThemeChoice } from "@/components/theme";
import { CameraIcon, LogOutIcon, TrashIcon } from "@/components/icons";

const initial: AccountFormState = {};

/** Mostra o retorno da action como toast de sucesso ou alerta de erro. */
function useFeedback(state: AccountFormState) {
  useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state]);
  return state.error ? <Alert>{state.error}</Alert> : null;
}

export function AvatarForm({ src, name, email }: { src: string | null; name: string | null; email: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadAvatarAction, initial);
  const [removing, startRemoving] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const feedback = useFeedback(state);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-center gap-4">
      <Avatar src={src} name={name} email={email} size={72} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            name="avatar"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Escolher foto"
            onChange={() => formRef.current?.requestSubmit()}
          />
          <Button variant="outline" size="sm" disabled={pending} onClick={() => fileRef.current?.click()}>
            <CameraIcon /> {pending ? "Enviando…" : "Trocar foto"}
          </Button>
          {src ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={removing}
              onClick={() =>
                startRemoving(async () => {
                  const result = await removeAvatarAction();
                  if (!result.ok) toast.error(result.error);
                  else router.refresh();
                })
              }
            >
              Remover
            </Button>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">PNG, JPG ou WebP, até 2 MB.</span>
        {feedback}
      </div>
    </form>
  );
}

export function ProfileForm({ name, email, bio }: { name: string | null; email: string; bio: string | null }) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  const feedback = useFeedback(state);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" defaultValue={name ?? ""} maxLength={120} required autoComplete="name" />
        </Field>
        <Field>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" value={email} disabled readOnly />
        </Field>
      </div>
      <Field>
        <Label htmlFor="bio">Mini-bio</Label>
        <Textarea id="bio" name="bio" defaultValue={bio ?? ""} maxLength={400} placeholder="Ex.: Palestrante sobre IA no trabalho e produtividade." />
        <p className="text-xs text-muted-foreground">Aparece para a plateia na tela de entrada da sessão e no relatório em PDF.</p>
      </Field>
      {feedback}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar perfil"}
        </Button>
      </div>
    </form>
  );
}

export function PreferencesForm({
  timeZone,
  defaultSurveyTemplateId,
  defaultDuration,
  surveyOptions,
}: {
  timeZone: string;
  defaultSurveyTemplateId: string;
  defaultDuration: number | null;
  surveyOptions: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(updatePreferencesAction, initial);
  const feedback = useFeedback(state);
  const knownZone = TIME_ZONE_OPTIONS.some((o) => o.value === timeZone);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="timeZone">Fuso horário</Label>
          <Select id="timeZone" name="timeZone" defaultValue={timeZone}>
            {knownZone ? null : <option value={timeZone}>{timeZone}</option>}
            {TIME_ZONE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">Usado para as datas e horários das suas sessões.</p>
        </Field>
        <Field>
          <Label htmlFor="defaultSurveyTemplateId">Pesquisa padrão para novas sessões</Label>
          <Select id="defaultSurveyTemplateId" name="defaultSurveyTemplateId" defaultValue={defaultSurveyTemplateId}>
            {surveyOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="defaultDuration">Duração padrão (min)</Label>
          <Input id="defaultDuration" name="defaultDuration" type="number" min={1} max={1440} defaultValue={defaultDuration ?? 60} />
        </Field>
        <Field>
          <span className="text-sm font-medium leading-none">Tema</span>
          <ThemeChoice />
          <p className="text-xs text-muted-foreground">Vale para este navegador.</p>
        </Field>
      </div>
      {feedback}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar preferências"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  const feedback = useFeedback(state);
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="password">Nova senha</Label>
          <Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required placeholder="Mínimo de 8 caracteres" />
        </Field>
        <Field>
          <Label htmlFor="confirm">Confirmar nova senha</Label>
          <Input id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required />
        </Field>
      </div>
      {feedback}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Trocando…" : "Trocar senha"}
        </Button>
      </div>
    </form>
  );
}

export function SignOutOthersButton() {
  const [pending, startTransition] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
      {confirmDialog}
      <Button
        variant="outline"
        disabled={pending}
        onClick={async () => {
          const confirmed = await confirm({
            title: "Sair de todos os outros dispositivos?",
            description: "Você continua conectado aqui. Nos outros navegadores será preciso entrar de novo.",
            confirmLabel: "Sair dos outros",
          });
          if (!confirmed) return;
          startTransition(async () => {
            const result = await signOutOthersAction();
            if (!result.ok) toast.error(result.error);
            else toast.success("Pronto: os outros dispositivos foram desconectados.");
          });
        }}
      >
        <LogOutIcon /> Sair de todos os outros dispositivos
      </Button>
    </>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccountAction, initial);
  const [typed, setTyped] = useState("");
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field>
        <Label htmlFor="confirm-delete">
          Digite <strong className="font-script">EXCLUIR</strong> para confirmar
        </Label>
        <Input
          id="confirm-delete"
          name="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="max-w-xs"
        />
      </Field>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div>
        <Button type="submit" variant="destructive" disabled={pending || typed !== "EXCLUIR"}>
          <TrashIcon /> {pending ? "Excluindo…" : "Excluir minha conta"}
        </Button>
      </div>
    </form>
  );
}
