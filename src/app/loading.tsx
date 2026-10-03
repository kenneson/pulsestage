// Páginas públicas (entrada, participante, projetor, feedback): indicador discreto e centralizado.
export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center" aria-busy="true">
      <span role="status" className="flex items-center gap-3 text-muted-foreground">
        <span className="size-5 animate-spin rounded-full border-2 border-muted border-t-primary" aria-hidden />
        Carregando…
      </span>
    </main>
  );
}
