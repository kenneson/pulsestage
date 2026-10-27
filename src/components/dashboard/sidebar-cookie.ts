/**
 * Cookie da barra lateral recolhida: lido no servidor (layout do painel) para a página já nascer do jeito
 * certo, sem piscar. Fica fora de nav-links.tsx porque exportações de um módulo "use client" chegam ao
 * servidor como referências, não como valores.
 */
export const SIDEBAR_COOKIE = "ps_sidebar";
