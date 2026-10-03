"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, type AuthFormState } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";

const initial: AuthFormState = {};

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(signInAction, initial);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
        <CardDescription>Acesse suas sessões e analytics.</CardDescription>
      </CardHeader>
      <CardContent>
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
        )}
      </CardContent>
    </Card>
  );
}
