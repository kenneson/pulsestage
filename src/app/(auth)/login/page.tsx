import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/auth-forms";
import { safeNextPath } from "@/lib/action-result";
import { getPublicHref, localeAlternates } from "@/i18n/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("metaTitle"), alternates: await localeAlternates("/login") };
}

const NOTICES = { confirmacao: "confirmation", google: "google" } as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const [t, href] = await Promise.all([getTranslations("auth.login.notices"), getPublicHref()]);
  const notice = error && Object.hasOwn(NOTICES, error) ? t(NOTICES[error as keyof typeof NOTICES]) : undefined;
  return <LoginForm next={next ? safeNextPath(next) : undefined} notice={notice} signupHref={href("/signup")} />;
}
