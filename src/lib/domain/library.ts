// Biblioteca de perguntas: as interações de todas as sessões do speaker, sem repetição.
// Regra pura (sem I/O): a mesma pergunta usada em várias sessões vira um item só.

export type LibrarySource = {
  id: string;
  sessionId: string;
  type: string;
  title: string;
  createdAt: string;
  optionLabels: string[];
  /** respostas ÷ participantes da sessão; null quando a sessão não teve participantes */
  participation: number | null;
};

export type LibraryItem = {
  key: string;
  /** interação mais recente com esse conteúdo: é a que será copiada */
  sourceId: string;
  type: string;
  title: string;
  optionLabels: string[];
  sessions: number;
  participation: number | null;
  lastUsedAt: string;
};

const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export function libraryKey(source: Pick<LibrarySource, "type" | "title" | "optionLabels">): string {
  return [source.type, normalize(source.title), ...source.optionLabels.map(normalize)].join("␟");
}

export function buildLibrary(sources: readonly LibrarySource[]): LibraryItem[] {
  const groups = new Map<string, LibrarySource[]>();
  for (const source of sources) {
    const key = libraryKey(source);
    const list = groups.get(key);
    if (list) list.push(source);
    else groups.set(key, [source]);
  }

  const items: LibraryItem[] = [];
  for (const [key, list] of groups) {
    const latest = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!latest) continue;
    const rates = list.map((s) => s.participation).filter((r): r is number => r !== null);
    items.push({
      key,
      sourceId: latest.id,
      type: latest.type,
      title: latest.title,
      optionLabels: latest.optionLabels,
      sessions: new Set(list.map((s) => s.sessionId)).size,
      participation: rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
      lastUsedAt: latest.createdAt,
    });
  }
  return items.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

/** Busca sem acento e sem diferenciar maiúsculas, no título e nas alternativas. */
export function matchesLibraryQuery(item: Pick<LibraryItem, "title" | "optionLabels">, query: string): boolean {
  const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
  const q = fold(query.trim());
  return q === "" || fold([item.title, ...item.optionLabels].join(" ")).includes(q);
}
