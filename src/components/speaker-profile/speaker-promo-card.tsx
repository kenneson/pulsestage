import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SurveyPromo } from "@/lib/data/speaker-profile";
import { localizedPath, type Locale } from "@/lib/domain/locale";
import { Avatar } from "@/components/avatar";
import { ChevronRightIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * "Conheça o palestrante": aparece depois da pesquisa, quando o speaker liga a opção no perfil público.
 * `locale`: idioma da sessão (o da pesquisa), não o do navegador; o perfil abre no mesmo idioma.
 */
export async function SpeakerPromoCard({ promo, locale, className }: { promo: SurveyPromo; locale: Locale; className?: string }) {
  const t = await getTranslations({ locale, namespace: "participant.promo" });
  return (
    <Link
      href={localizedPath(locale, `/p/${promo.slug}`)}
      className={cn("flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted", className)}
    >
      <Avatar src={promo.avatarUrl} name={promo.name} email={promo.name} size={48} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-muted-foreground">{t("label")}</span>
        <span className="truncate font-semibold">{promo.name}</span>
        {promo.headline ? <span className="line-clamp-2 text-sm text-muted-foreground">{promo.headline}</span> : null}
      </span>
      <ChevronRightIcon className="shrink-0 text-muted-foreground" />
    </Link>
  );
}
