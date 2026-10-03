import Image from "next/image";
import { cn } from "@/lib/utils";

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Foto do perfil ou iniciais em papel azul. */
export function Avatar({
  src,
  name,
  email,
  size = 32,
  className,
}: {
  src: string | null;
  name: string | null;
  email: string;
  size?: number;
  className?: string;
}) {
  return src ? (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded-full object-cover", className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full bg-rev-blue font-semibold text-rev-foreground", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials(name, email)}
    </span>
  );
}
