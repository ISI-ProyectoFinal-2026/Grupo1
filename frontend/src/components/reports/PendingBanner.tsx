import Spinner from "@/components/ui/Spinner";

interface PendingBannerProps {
  className?: string;
}

export default function PendingBanner({ className = "" }: PendingBannerProps) {
  return (
    <div
      className={`flex animate-fade items-center gap-3 rounded-card border border-signal-track bg-signal-soft p-4 text-ink ${className}`}
    >
      <Spinner size="sm" />
      <span>Estamos procesando tu reporte… buscando coincidencias</span>
    </div>
  );
}
