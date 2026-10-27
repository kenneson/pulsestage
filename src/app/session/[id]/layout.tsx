import { getTranslations } from "next-intl/server";
import { MotionProvider } from "@/components/motion/motion-provider";
import { BrandScope } from "@/components/brand/brand-scope";
import { getSessionBrand } from "@/lib/brand/server";

// Celular da plateia e telão: as telas que mais se mexem (pergunta que chega, resultados, ranking).
// Com "Usar minha marca" na sessão e logo ou cor no perfil, a área toda ganha a cor e o logo do palestrante.
export default async function SessionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const brand = await getSessionBrand((await params).id);
  if (!brand) return <MotionProvider>{children}</MotionProvider>;
  const t = await getTranslations({ locale: brand.locale, namespace: "account.brand" });
  return (
    <MotionProvider>
      <BrandScope palette={brand.palette} logoUrl={brand.logoUrl} logoAlt={t("logoAlt")}>
        {children}
      </BrandScope>
    </MotionProvider>
  );
}
