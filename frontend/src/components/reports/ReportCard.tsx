import { Link } from "react-router-dom";
import type { ReportDTO } from "@/types/report.types";
import Badge from "@/components/ui/Badge";

interface ReportCardProps {
  report: ReportDTO;
}

export default function ReportCard({ report }: ReportCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", { month: "short", day: "numeric" });
  };

  return (
    <Link to={`/reports/${report.id}`}>
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden flex gap-4 h-32">
        {report.imageUrl ? (
          <img
            src={report.imageUrl}
            alt={report.title}
            className="w-32 h-32 object-cover"
          />
        ) : (
          <div className="w-32 h-32 bg-gray-200 flex items-center justify-center">
            <span className="text-4xl">🐾</span>
          </div>
        )}

        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 line-clamp-1">
                {report.title}
              </h3>
              {report.tag && (
                <Badge
                  label={report.tag.label}
                  backgroundColor={report.tag.color}
                />
              )}
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">
              {report.description || "Sin descripción"}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              📍 {report.locationAddress || "Ubicación desconocida"}
            </p>
            <p className="text-xs text-gray-400">{formatDate(report.createdAt)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
