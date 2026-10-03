"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, signInWithGoogleAction, signUpAction, type AuthFormState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";

const initial: AuthFormState = {};

function GoogleSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} className="w-full">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1C3.3 21.4 7.3 24 12 24z" />
        <path fill="#FBBC05" d="M5.3 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5h-4C.5 8.2 0 10 0 12s.5 3.8 1.3 5.5l4-3.1z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.6 1.3 6.5l4 3.1c1-2.8 3.6-4.8 6.7-4.8z" />
      </svg>
      {pending ? "Redirecionando…" : "Continuar com Google"}
    </Button>
  );
}

/** Formulário próprio: não pode ficar dentro do form de e-mail/senha. */
function GoogleSignIn({ next }: { next?: string }) {
  return (
    <>
      <form action={signInWithGoogleAction}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <GoogleSubmit />
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou com e-mail
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Acesse suas sessões e analytics.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <GoogleSignIn next={next} />
        <form action={action} className="grid gap-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {notice ? <Alert tone="info">{notice}</Alert> : null}
          <Field>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          {state.error ? <Alert>{state.error}</Alert> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Entrando…" : "Entrar"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Criar conta
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Criar conta</CardTitle>
        <CardDescription>Comece a criar sessões interativas.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.message ? (
          <Alert tone="success">{state.message}</Alert>
        ) : (
          <div className="grid gap-4">
            <GoogleSignIn />
            <form action={action} className="grid gap-4">
              <Field>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" autoComplete="name" required maxLength={120} />
              </Field>
              <Field>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </Field>
              <Field>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
                <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres.</p>
              </Field>
              {state.error ? <Alert>{state.error}</Alert> : null}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Criando…" : "Criar conta"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Ao criar a conta, você concorda com a{" "}
                <Link href="/privacidade" className="underline hover:text-foreground">
                  política de privacidade
                </Link>
                .
              </p>
              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Entrar
                </Link>
              </p>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
