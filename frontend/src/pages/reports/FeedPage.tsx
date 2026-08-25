import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listReports } from "@/services/reports.service";
import type { ReportType } from "@/types/report.types";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import FilterBar from "@/components/reports/FilterBar";
import ReportCard from "@/components/reports/ReportCard";
import MapView from "@/components/reports/MapView";

export default function FeedPage() {
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [type, setType] = useState<ReportType | "">("");
  const [zone, setZone] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ["reports", { type: type || undefined, zone: zone || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }],
    queryFn: () =>
      listReports({
        type: type || undefined,
        zone: zone || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const sortedReports = [...reports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
            <Link to="/reports/new">
              <Button variant="primary">+ Crear Reporte</Button>
            </Link>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-900 hover:bg-gray-300"
              }`}
            >
              📋 Lista
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                viewMode === "map"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-900 hover:bg-gray-300"
              }`}
            >
              🗺️ Mapa
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <FilterBar
          type={type}
          zone={zone}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onTypeChange={setType}
          onZoneChange={setZone}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
        />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            Error al cargar reportes. Intentá de nuevo.
          </div>
        ) : viewMode === "map" ? (
          <MapView reports={sortedReports} />
        ) : sortedReports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-600 text-lg">No hay reportes que coincidan con tus filtros</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sortedReports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
