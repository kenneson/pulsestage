import type { Metadata, Viewport } from "next";
import { Geist, Plus_Jakarta_Sans } from "next/font/google";
import { getLocale, getTranslations } from "next-intl/server";
import { ThemedToaster } from "@/components/theme";
import { IntlProvider } from "@/i18n/provider";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
// Fonte de destaque: títulos, numerais de dados e códigos de entrada.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-jakarta",
});

// Aplica o tema salvo (ou o do sistema) antes da primeira pintura, sem flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

function safeUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.meta");
  return {
    // Completa os caminhos relativos (canonical, hreflang, Open Graph) com o domínio público.
    metadataBase: safeUrl(publicEnv.appUrl),
    title: { default: "PulseStage", template: "%s · PulseStage" },
    description: t("description"),
    applicationName: "PulseStage",
    // Instalado na tela de início (app/manifest.ts): abre sem a barra do navegador; barra de status opaca.
    appleWebApp: { capable: true, title: "PulseStage", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Ocupa a tela toda (cantos arredondados, barra de gestos); as barras fixas do celular usam env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1324" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    // suppressHydrationWarning: o script abaixo adiciona a classe `dark` antes da hidratação.
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${geist.variable} ${jakarta.variable} min-h-dvh font-sans`}>
        <IntlProvider>
          {children}
          <ThemedToaster />
        </IntlProvider>
      </body>
    </html>
  );
}
