import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Formulário GET simples: funciona sem JavaScript. */
export function JoinCodeForm({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/join" method="get" className="flex w-full gap-2">
      <Input
        name="code"
        defaultValue={defaultValue}
        placeholder="Código da sessão"
        aria-label="Código da sessão"
        autoCapitalize="characters"
        autoComplete="off"
        maxLength={10}
        required
        className="h-12 text-center text-lg font-semibold uppercase tracking-widest"
      />
      <Button type="submit" size="lg" className="h-12">
        Entrar
      </Button>
    </form>
  );
}
