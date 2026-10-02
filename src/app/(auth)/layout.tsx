import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-10">
      <Logo />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
