import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getReport } from "@/services/reports.service";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: report, isLoading, error } = useQuery({
    queryKey: ["report", id],
    queryFn: () => getReport(Number(id)),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Error al cargar el reporte
        </div>
        <Button
          variant="secondary"
          onClick={() => navigate("/reports")}
          className="mt-4"
        >
          Volver a reportes
        </Button>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-AR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Button
        variant="secondary"
        onClick={() => navigate("/reports")}
        className="mb-6"
      >
        ← Volver
      </Button>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {report.imageUrl && (
          <img
            src={report.imageUrl}
            alt={report.title}
            className="w-full h-96 object-cover"
          />
        )}

        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {report.title}
              </h1>
              {report.tag && (
                <span
                  className="inline-block px-4 py-1 rounded-full text-white text-sm font-semibold"
                  style={{ backgroundColor: report.tag.color }}
                >
                  {report.tag.label}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Ubicación
              </h3>
              <p className="text-lg text-gray-900">
                {report.locationAddress || "Ubicación desconocida"}
              </p>
              {report.location && (
                <p className="text-sm text-gray-500">
                  {report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Fecha</h3>
              <p className="text-lg text-gray-900">
                {formatDate(report.createdAt)}
              </p>
              {report.publishedAt && (
                <p className="text-sm text-gray-500">
                  Publicado: {formatDate(report.publishedAt)}
                </p>
              )}
            </div>
          </div>

          {report.description && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Descripción
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {report.description}
              </p>
            </div>
          )}

          <div className="border-t pt-6">
            <p className="text-sm text-gray-500">
              Estado: <span className="font-semibold text-gray-900">{report.status}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
