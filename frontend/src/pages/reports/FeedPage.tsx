import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listReports } from "@/services/reports.service";
import type { ReportType } from "@/types/report.types";
import { buttonClasses } from "@/components/ui/buttonClasses";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { ListIcon, MapIcon, PawIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
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
    queryKey: ["reports", { type, zone, dateFrom, dateTo }],
    queryFn: () =>
      listReports({
        status: "published",
        type: type || undefined,
        zone: zone || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const sortedReports = [...reports].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const viewButton = (mode: "list" | "map") =>
    cn(
      "inline-flex min-h-10 items-center gap-1.5 rounded-[9px] px-3 text-sm font-bold transition-colors",
      viewMode === mode ? "bg-ink text-white" : "text-ink-muted hover:text-ink",
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-display-lg">Reportes</h1>
        <div className="flex items-center gap-2">
          {/* En mobile el alta ya está en la tab bar ("Reportar"). */}
          <Link to="/reports/new" className={buttonClasses("signal", "md", "hidden sm:inline-flex")}>
            + Crear Reporte
          </Link>
          <div role="group" aria-label="Vista" className="inline-flex rounded-control border border-line bg-paper p-1">
            <button
              type="button"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
              className={viewButton("list")}
            >
              <ListIcon className="h-[18px] w-[18px]" />
              Lista
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "map"}
              onClick={() => setViewMode("map")}
              className={viewButton("map")}
            >
              <MapIcon className="h-[18px] w-[18px]" />
              Mapa
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4">
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
      </div>

      <div className="mt-5" aria-live="polite">
        {isLoading ? (
          <div className="flex justify-center py-16 text-ink-muted">
            <Spinner />
          </div>
        ) : error ? (
          <ErrorMessage
            message="Error al cargar reportes. Intentá de nuevo."
            className="card p-4"
          />
        ) : viewMode === "map" ? (
          <MapView reports={sortedReports} />
        ) : sortedReports.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line px-6 py-12 text-center">
            <PawIcon className="h-10 w-10 text-ink-muted" strokeWidth={1.5} />
            <p className="text-lg text-ink">No hay reportes que coincidan con tus filtros</p>
            <Link to="/reports/new" className={buttonClasses("secondary", "md")}>
              Crear Reporte
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-muted">
              <span className="tabular">{sortedReports.length}</span>{" "}
              {sortedReports.length === 1 ? "reporte" : "reportes"}
            </p>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sortedReports.map((report) => (
                <li key={report.id}>
                  <ReportCard report={report} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
