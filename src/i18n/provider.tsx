import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { Locale } from "@/lib/domain/locale";
import type { Messages } from "../../messages/pt-BR";
import { pickMessages } from "./messages";
import { SERVER_ONLY_NAMESPACES, type Namespace } from "./namespaces";

/**
 * Traduções para Componentes Cliente. Sem `namespaces`, manda todas as áreas menos as de texto longo
 * (landing, privacidade, guia, e-mail). Com `locale`, usa outro idioma (o da sessão, na plateia).
 */
export async function IntlProvider({
  children,
  locale: explicit,
  namespaces,
}: {
  children: React.ReactNode;
  locale?: Locale;
  namespaces?: readonly Namespace[];
}) {
  const locale = explicit ?? (await getLocale());
  const all = (await getMessages({ locale })) as Messages;
  const picked = namespaces
    ? pickMessages(all, namespaces)
    : pickMessages(all, (Object.keys(all) as Namespace[]).filter((ns) => !SERVER_ONLY_NAMESPACES.includes(ns)));
  return (
    <NextIntlClientProvider locale={locale} messages={picked}>
      {children}
    </NextIntlClientProvider>
  );
}
