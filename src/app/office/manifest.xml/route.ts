import { getTranslations } from "next-intl/server";
import { publicEnv } from "@/lib/env";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/domain/locale";

// Manifesto do suplemento de conteúdo do PowerPoint (Office Add-in "ContentApp", esquema 1.1).
// Gerado a cada pedido com o endereço público do app (NEXT_PUBLIC_APP_URL, ver lib/domain/app-url.ts):
// o PowerPoint carrega `${appUrl}/office` direto dentro do slide.

/** Identidade fixa do suplemento: trocar o GUID faria o Office tratá-lo como outro suplemento. */
const ADDIN_ID = "4113c49e-0464-441b-9ce6-26155b45244c";
const VERSION = "1.0.0.0";
/** O Office usa culturas com país (es-MX, es-ES…): o espanhol latino neutro vale para as duas. */
const OFFICE_LOCALES: Record<Locale, string[]> = { "pt-BR": ["pt-BR"], "es-419": ["es-MX", "es-ES"], "en-US": ["en-US"] };

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET() {
  const app = publicEnv.appUrl;
  const texts = await Promise.all(
    LOCALES.map(async (locale) => {
      const t = await getTranslations({ locale, namespace: "integrations.office.manifest" });
      return { locale, name: t("name"), description: t("description") };
    }),
  );
  const main = texts.find((x) => x.locale === DEFAULT_LOCALE) ?? texts[0]!;
  const overrides = (field: "name" | "description") =>
    texts
      .filter((x) => x.locale !== main.locale)
      .flatMap((x) => OFFICE_LOCALES[x.locale].map((tag) => `\n    <Override Locale="${tag}" Value="${xml(x[field])}" />`))
      .join("");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:type="ContentApp">
  <Id>${ADDIN_ID}</Id>
  <Version>${VERSION}</Version>
  <ProviderName>PulseStage</ProviderName>
  <DefaultLocale>${main.locale}</DefaultLocale>
  <DisplayName DefaultValue="${xml(main.name)}">${overrides("name")}
  </DisplayName>
  <Description DefaultValue="${xml(main.description)}">${overrides("description")}
  </Description>
  <IconUrl DefaultValue="${xml(`${app}/office/icon/32`)}" />
  <HighResolutionIconUrl DefaultValue="${xml(`${app}/office/icon/64`)}" />
  <SupportUrl DefaultValue="${xml(`${app}/dashboard/integracoes#powerpoint`)}" />
  <AppDomains>
    <AppDomain>${xml(app)}</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Presentation" />
  </Hosts>
  <DefaultSettings>
    <SourceLocation DefaultValue="${xml(`${app}/office`)}" />
    <RequestedWidth>960</RequestedWidth>
    <RequestedHeight>540</RequestedHeight>
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>
  <AllowSnapshot>true</AllowSnapshot>
</OfficeApp>
`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pulsestage-powerpoint.xml"',
      "Cache-Control": "no-store",
    },
  });
}
