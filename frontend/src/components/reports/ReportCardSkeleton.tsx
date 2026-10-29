import { Skeleton } from "@/components/ui/Skeleton";

// Misma caja que ReportCard: la grilla no salta al llegar los datos.
export default function ReportCardSkeleton() {
  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <div className="mt-auto flex items-center justify-between pt-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}
