import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignUpForm } from "@/components/auth/auth-forms";
import { getPublicHref } from "@/i18n/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("metaTitle") };
}

export default async function SignUpPage() {
  const href = await getPublicHref();
  return <SignUpForm loginHref={href("/login")} privacyHref={href("/privacidade")} />;
}
