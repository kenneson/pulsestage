// Limites simples em memória (por instância do servidor). Regra pura: quem chama guarda o Map.
// Servem contra abuso pontual; limites que precisam valer entre instâncias ficam no banco.

/** Janela deslizante: registra a tentativa e diz se passou do teto `max` em `windowMs`. */
export function hitWindow(store: Map<string, number[]>, key: string, now: number, windowMs: number, max: number): boolean {
  const recent = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  store.delete(key);
  store.set(key, recent);
  pruneOldest(store);
  return recent.length > max;
}

/** O Map não cresce sem fim: passando de `maxKeys`, saem as chaves mais antigas (ordem de inserção). */
export function pruneOldest<V>(store: Map<string, V>, maxKeys = 10_000): void {
  if (store.size <= maxKeys) return;
  let extra = store.size - maxKeys;
  for (const key of store.keys()) {
    if (extra-- <= 0) break;
    store.delete(key);
  }
}
