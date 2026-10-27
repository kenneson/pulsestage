import type { BrandPalette } from "@/lib/domain/brand";
import { BrandProvider } from "./brand-context";

/**
 * Aplica a cor do palestrante (`--primary`, `--primary-foreground`, `--ring`) só dentro da área da sessão
 * e expõe o logo para o <BrandMark>. As cores já vêm ajustadas para 4,5:1 em cada tema (lib/domain/brand.ts).
 *
 * O telão força `.dark` no próprio contêiner: por isso a regra do escuro vale tanto para a área dentro do
 * `<html class="dark">` quanto para um `.dark` dentro dela (especificidade maior que a do `.dark` global).
 */
export function BrandScope({
  palette,
  logoUrl,
  logoAlt,
  children,
}: {
  palette: BrandPalette | null;
  logoUrl: string | null;
  logoAlt: string;
  children: React.ReactNode;
}) {
  // Valores em hex validados pelo domínio (nunca texto livre do usuário): seguro dentro do <style>.
  const css = palette
    ? `[data-brand-scope]{--primary:${palette.light.primary};--primary-foreground:${palette.light.foreground};--ring:${palette.light.primary}}` +
      `.dark [data-brand-scope],[data-brand-scope] .dark{--primary:${palette.dark.primary};--primary-foreground:${palette.dark.foreground};--ring:${palette.dark.primary}}`
    : null;
  return (
    <div data-brand-scope="" className="contents">
      {css ? <style>{css}</style> : null}
      <BrandProvider value={{ logoUrl, logoAlt }}>{children}</BrandProvider>
    </div>
  );
}
