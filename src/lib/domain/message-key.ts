// Mensagens traduzíveis que saem das regras puras (validação do Zod, motivos, erros) como texto:
// "validation.maxWinners|max=50". A chave é relativa à área `errors` das traduções; quem mostra a mensagem
// traduz com translateMessage (src/i18n/errors.ts). Regra pura (sem I/O).

export type MessageParams = Record<string, string | number>;

export function messageKey(key: string, params?: MessageParams): string {
  if (!params) return key;
  const encoded = Object.entries(params).map(([name, value]) => `${name}=${encodeURIComponent(String(value))}`);
  return [key, ...encoded].join("|");
}

/** Chave e parâmetros; texto que não é chave (sem "." ou com espaço) volta como chave inválida (null). */
export function parseMessageKey(message: string): { key: string; params: Record<string, string> } | null {
  const [key = "", ...parts] = message.split("|");
  if (!/^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/.test(key)) return null;
  const params: Record<string, string> = {};
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) return null;
    try {
      params[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
    } catch {
      return null;
    }
  }
  return { key, params };
}
