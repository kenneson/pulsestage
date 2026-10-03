import { Skeleton } from "@/components/ui/misc";

// Mostrado dentro do layout (o cabeçalho continua visível) enquanto a página do dashboard carrega.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <span className="sr-only" role="status">
        Carregando…
      </span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
