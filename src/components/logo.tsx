import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Marca do PulseStage. `href={null}` desenha sem link: nas telas da plateia (celular, pesquisa,
 * entrada por código) um toque na marca não pode tirar a pessoa da sessão.
 */
export function Logo({ href = "/", className }: { href?: string | null; className?: string }) {
  const classes = cn("inline-flex items-center gap-2 font-semibold tracking-tight", className);
  const content = (
    <>
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M3 12h4l2-5 4 10 2-5h6" />
        </svg>
      </span>
      PulseStage
    </>
  );
  if (href === null) return <span className={classes}>{content}</span>;
  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
