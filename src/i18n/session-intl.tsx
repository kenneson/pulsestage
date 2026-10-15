import type { Locale } from "@/lib/domain/locale";
import { IntlProvider } from "./provider";

/**
 * Celular da plateia e telão falam o idioma da sessão (escolhido pelo palestrante), não o do navegador:
 * na mesma sala, todo mundo vê os botões no idioma das perguntas. Nos Server Components dessas páginas,
 * use getTranslations({ locale, namespace }) com o mesmo locale.
 */
export function SessionIntl({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <IntlProvider locale={locale} namespaces={["common", "errors", "domain", "participant", "display", "results"]}>
      <div lang={locale} className="contents">
        {children}
      </div>
    </IntlProvider>
  );
}
