import type { Messages } from "../../messages/pt-BR";

export type Namespace = keyof Messages;

/**
 * Áreas usadas só em Server Components (texto longo): não vão para o navegador por padrão.
 * Uma página com componente cliente dessas áreas embrulha o trecho com <IntlProvider namespaces={[...]}>.
 */
export const SERVER_ONLY_NAMESPACES: readonly Namespace[] = ["landing", "legal", "guide", "email"];
