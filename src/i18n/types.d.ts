import type { Locale } from "@/lib/domain/locale";
import type { Messages } from "../../messages/pt-BR";

// Chaves de tradução tipadas: t("chave-que-não-existe") não compila.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
