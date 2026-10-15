import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-10">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <Logo />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
