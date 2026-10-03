import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeNextPath } from "@/lib/action-result";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  confirmacao: "Não foi possível confirmar o e-mail. Tente entrar ou peça um novo link.",
  google: "Não foi possível entrar com o Google. Tente de novo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <LoginForm
      next={next ? safeNextPath(next) : undefined}
      notice={error && Object.hasOwn(NOTICES, error) ? NOTICES[error] : undefined}
    />
  );
}
