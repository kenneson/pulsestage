import { getRequestConfig } from "next-intl/server";
import { isLocale } from "@/lib/domain/locale";
import { APP_TIME_ZONE } from "@/lib/datetime";
import { getRequestLocale } from "./locale.server";
import { loadMessages } from "./messages";

// Configuração do next-intl por requisição. Um locale explícito (getTranslations({ locale })) vence:
// é assim que as páginas da plateia usam o idioma da sessão.
export default getRequestConfig(async ({ locale: explicit }) => {
  const locale = isLocale(explicit) ? explicit : await getRequestLocale();
  return {
    locale,
    messages: await loadMessages(locale),
    // Datas do painel usam o fuso do speaker (lib/datetime.ts); este é só o padrão do next-intl.
    timeZone: APP_TIME_ZONE,
  };
});
