type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

const PAGE_SIZE = 1000;

/** Busca todas as linhas de uma consulta, paginando (a API limita 1000 por requisição). */
export async function fetchAllRows<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return rows;
}
