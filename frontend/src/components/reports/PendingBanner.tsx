import Spinner from "@/components/ui/Spinner";

interface PendingBannerProps {
  className?: string;
}

export default function PendingBanner({ className = "" }: PendingBannerProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-card border border-signal bg-signal/15 p-4 text-ink ${className}`}
    >
      <Spinner size="sm" />
      <span>Estamos procesando tu reporte… buscando coincidencias</span>
    </div>
  );
}
