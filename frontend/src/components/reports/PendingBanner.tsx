import Spinner from "@/components/ui/Spinner";

interface PendingBannerProps {
  className?: string;
}

export default function PendingBanner({ className = "" }: PendingBannerProps) {
  return (
    <div
      className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 text-yellow-800 ${className}`}
    >
      <Spinner size="sm" />
      <span>Estamos procesando tu reporte... buscando coincidencias</span>
    </div>
  );
}
