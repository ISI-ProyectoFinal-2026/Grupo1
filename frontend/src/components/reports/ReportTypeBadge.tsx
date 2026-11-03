import type { ReportType } from "@/types/report.types";
import { cn } from "@/lib/cn";

// distintivo del tipo de reporte: siempre con texto, no solo color (#257)
const TYPE_BADGE: Record<ReportType, { label: string; className: string }> = {
  lost: { label: "Mascota Perdida", className: "bg-lost" },
  found: { label: "Mascota Encontrada", className: "bg-found" },
};

interface ReportTypeBadgeProps {
  reportType: ReportType;
  className?: string;
}

export default function ReportTypeBadge({ reportType, className }: ReportTypeBadgeProps) {
  const { label, className: tone } = TYPE_BADGE[reportType];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold leading-none text-white",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}
