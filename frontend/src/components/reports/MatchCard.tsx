import { Link } from "react-router-dom";
import type { MatchDTO } from "@/types/report.types";
import Badge from "@/components/ui/Badge";

interface MatchCardProps {
  match: MatchDTO;
}

const REPORT_TYPE_LABEL: Record<MatchDTO["reportType"], string> = {
  lost: "Perdido",
  found: "Encontrado",
};

const REPORT_TYPE_COLOR: Record<MatchDTO["reportType"], string> = {
  lost: "#EF4444",
  found: "#3B82F6",
};

export default function MatchCard({ match }: MatchCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", { month: "short", day: "numeric" });
  };

  return (
    <Link to={`/reports/${match.reportId}`}>
      <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden flex gap-4 h-32">
        {match.imageUrl ? (
          <img
            src={match.imageUrl}
            alt={match.title}
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
                {match.title}
              </h3>
              <Badge
                label={REPORT_TYPE_LABEL[match.reportType]}
                backgroundColor={REPORT_TYPE_COLOR[match.reportType]}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            {match.similarityScore !== null && (
              <p className="text-xs text-gray-500">
                {Math.round(match.similarityScore * 100)}% de coincidencia
              </p>
            )}
            <p className="text-xs text-gray-400">{formatDate(match.createdAt)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
