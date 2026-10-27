import "server-only";

/** Linhas por página do PostgREST (o padrão do Supabase devolve no máximo 1000). */
const PAGE = 1000;
/** Teto de segurança: 50 mil respostas por leitura. */
const MAX_PAGES = 50;

/** Lê todas as páginas de uma consulta (a função recebe o intervalo e devolve as linhas ou lança). */
export async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE, (i + 1) * PAGE - 1);
    if (error) throw new Error("query_failed");
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}
