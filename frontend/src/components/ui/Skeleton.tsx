import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
}

// Bloque de carga; decorativo, el estado lo anuncia SkeletonGroup.
export function Skeleton({ className }: SkeletonProps) {
  return <span aria-hidden="true" className={cn("skeleton block", className)} />;
}

interface SkeletonGroupProps {
  children: ReactNode;
  className?: string;
}

// Mismo nombre accesible que el Spinner ("Cargando").
export function SkeletonGroup({ children, className }: SkeletonGroupProps) {
  return (
    <div role="status" aria-label="Cargando" aria-busy="true" className={className}>
      {children}
    </div>
  );
}

export default Skeleton;
