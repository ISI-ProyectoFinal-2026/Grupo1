import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { listReports } from "@/services/reports.service";
import type { ReportType } from "@/types/report.types";
import { buttonClasses } from "@/components/ui/buttonClasses";
import ErrorMessage from "@/components/ui/ErrorMessage";
import SuccessMessage from "@/components/ui/SuccessMessage";
import { ListIcon, MapIcon, PlusIcon } from "@/components/ui/icons";
import EmptyState from "@/components/ui/EmptyState";
import { PawPrint } from "@/components/ui/canine";
import { cn } from "@/lib/cn";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import FilterBar from "@/components/reports/FilterBar";
import ReportCard from "@/components/reports/ReportCard";
import ReportCardSkeleton from "@/components/reports/ReportCardSkeleton";
import MapView from "@/components/reports/MapView";

export default function FeedPage() {
  // Aviso que deja la pantalla anterior (por ejemplo, al eliminar un reporte).
  const flashMessage = (useLocation().state as { message?: string } | null)?.message;
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
      "press relative z-10 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-bold",
      viewMode === mode ? "text-paper" : "text-ink-muted hover:text-ink",
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-display-lg">Reportes</h1>
        <div className="flex items-center gap-2">
          {/* En mobile el alta ya está en la tab bar ("Reportar"). */}
          <Link to="/reports/new" className={buttonClasses("signal", "md", "hidden sm:inline-flex")}>
            <PlusIcon className="h-5 w-5" strokeWidth={2.5} />
            Crear Reporte
          </Link>
          <div
            role="group"
            aria-label="Vista"
            className="relative grid grid-cols-2 rounded-full border border-line bg-paper p-1"
          >
            {/* indicador que se desliza entre Lista y Mapa */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink transition-transform duration-base ease-in-out",
                viewMode === "map" && "translate-x-full",
              )}
            />
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

      {flashMessage && <SuccessMessage message={flashMessage} className="mt-4" />}

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
          <SkeletonGroup className="animate-fade">
            <p aria-hidden="true" className="mb-3 flex h-5 items-center gap-1.5 text-sm text-ink-muted">
              <PawPrint className="h-3.5 w-3.5" />
              Olfateando reportes…
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <ReportCardSkeleton key={index} />
              ))}
            </div>
          </SkeletonGroup>
        ) : error ? (
          <ErrorMessage
            message="Error al cargar reportes. Intentá de nuevo."
            className="card p-4"
          />
        ) : viewMode === "map" ? (
          <MapView reports={sortedReports} />
        ) : sortedReports.length === 0 ? (
          <EmptyState
            action={
              <Link to="/reports/new" className={buttonClasses("secondary", "md")}>
                Crear Reporte
              </Link>
            }
          >
            <p className="max-w-xs text-balance font-display text-display-sm text-ink">
              No hay reportes que coincidan con tus filtros
            </p>
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-muted">
              <span className="tabular">{sortedReports.length}</span>{" "}
              {sortedReports.length === 1 ? "reporte" : "reportes"}
            </p>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {sortedReports.map((report, index) => (
                <li
                  key={report.id}
                  className="animate-rise"
                  // stagger corto y con tope: la lista nunca tarda en estar completa
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
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
