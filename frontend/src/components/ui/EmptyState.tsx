import type { ReactNode } from "react";
import { SniffingDog } from "@/components/ui/canine";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

// Estado vacio con el perro olfateando.
export default function EmptyState({ children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex animate-rise flex-col items-center gap-3 rounded-card border border-dashed border-line bg-paper/60 px-6 py-10 text-center",
        className,
      )}
    >
      <SniffingDog className="w-36" />
      {children}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
