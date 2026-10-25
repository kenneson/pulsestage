import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Formulário GET simples: funciona sem JavaScript. */
export function JoinCodeForm({ defaultValue = "" }: { defaultValue?: string }) {
  const t = useTranslations("participant.codeForm");
  return (
    <form action="/join" method="get" className="flex w-full gap-2">
      <Input
        name="code"
        defaultValue={defaultValue}
        placeholder={t("placeholder")}
        aria-label={t("label")}
        autoCapitalize="characters"
        autoComplete="off"
        maxLength={10}
        required
        className="h-12 text-center text-lg font-semibold uppercase tracking-widest max-md:h-12"
      />
      <Button type="submit" size="lg" className="h-12">
        {t("submit")}
      </Button>
    </form>
  );
}
