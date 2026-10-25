import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-10 max-md:gap-6 max-md:pb-[max(env(safe-area-inset-bottom),2.5rem)] max-md:pt-20">
      {/* Celular: o padding de cima reserva a barra de idioma e tema, que nunca cobre a marca. */}
      <div className="absolute right-4 top-4 flex items-center gap-2 max-md:top-[max(env(safe-area-inset-top),1rem)]">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <Logo />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
