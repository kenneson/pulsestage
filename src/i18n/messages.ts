import "server-only";
import type { Locale } from "@/lib/domain/locale";
import type { Messages } from "../../messages/pt-BR";
import type { Namespace } from "./namespaces";

const LOADERS: Record<Locale, () => Promise<Messages>> = {
  "pt-BR": () => import("../../messages/pt-BR").then((m) => m.default),
  "es-419": () => import("../../messages/es-419").then((m) => m.default),
  "en-US": () => import("../../messages/en-US").then((m) => m.default),
};

export function loadMessages(locale: Locale): Promise<Messages> {
  return LOADERS[locale]();
}

/** Só as áreas pedidas (o que vai para o navegador). */
export function pickMessages(messages: Messages, namespaces: readonly Namespace[]): Partial<Messages> {
  const out: Partial<Messages> = {};
  for (const ns of namespaces) Object.assign(out, { [ns]: messages[ns] });
  return out;
}
