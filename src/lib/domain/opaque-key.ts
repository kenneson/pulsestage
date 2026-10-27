// Chave estável para listas animadas no telão (ranking, sala de espera) sem expor o id do participante.
// Regra pura (sem I/O): dois FNV-1a de 32 bits com sementes diferentes = 64 bits, colisão desprezível
// para as poucas dezenas de linhas de uma tela, e o id não pode ser recuperado a partir dela.

function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function opaqueKey(id: string): string {
  return fnv1a(id, 0x811c9dc5) + fnv1a(id, 0x9747b28c);
}
