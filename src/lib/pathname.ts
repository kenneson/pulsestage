import { headers } from "next/headers";
import { PATHNAME_HEADER } from "./pathname-header";

/** Caminho atual sem prefixo de idioma, ou "" fora das rotas do proxy. Só em Server Components. */
export async function getPathname(): Promise<string> {
  return (await headers()).get(PATHNAME_HEADER) ?? "";
}
