import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemedToaster } from "@/components/theme";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

// Aplica o tema salvo (ou o do sistema) antes da primeira pintura, sem flash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export const metadata: Metadata = {
  title: { default: "PulseStage", template: "%s · PulseStage" },
  description: "Seu público fala. Você entende. Sua próxima palestra fica melhor.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#16171d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: o script abaixo adiciona a classe `dark` antes da hidratação.
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${geist.variable} min-h-dvh font-sans`}>
        {children}
        <ThemedToaster />
      </body>
    </html>
  );
}
