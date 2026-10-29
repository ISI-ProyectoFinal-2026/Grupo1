import { useState } from "react";
import type { ReportType } from "@/types/report.types";
import Input from "@/components/ui/Input";
import { FilterIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

interface FilterBarProps {
  type: ReportType | "";
  zone: string;
  dateFrom: string;
  dateTo: string;
  onTypeChange: (type: ReportType | "") => void;
  onZoneChange: (zone: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
}

export default function FilterBar({
  type,
  zone,
  dateFrom,
  dateTo,
  onTypeChange,
  onZoneChange,
  onDateFromChange,
  onDateToChange,
}: FilterBarProps) {
  // En mobile zona y fechas se pliegan detras de "Más filtros"; en desktop
  // siempre estan a la vista. Los campos quedan siempre montados.
  const [isExpanded, setIsExpanded] = useState(false);
  const extraCount = [zone, dateFrom, dateTo].filter(Boolean).length;

  return (
    <section aria-label="Filtros" className="card p-3 sm:p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="filter-type" className="field-label">
              Tipo
            </label>
            <select
              id="filter-type"
              value={type}
              onChange={(e) => onTypeChange((e.target.value as ReportType) || "")}
              className="field"
            >
              <option value="">Todos</option>
              <option value="lost">Perdidas</option>
              <option value="found">Encontradas</option>
            </select>
          </div>
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls="filtros-extra"
            onClick={() => setIsExpanded((open) => !open)}
            className={cn(
              "press inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-paper px-4 font-bold text-ink hover:border-ink-muted md:hidden",
              isExpanded ? "border-ink-muted" : "border-line",
            )}
          >
            <FilterIcon className="h-5 w-5" />
            Más filtros
            {extraCount > 0 && (
              <span className="tabular grid h-5 min-w-5 animate-pop place-items-center rounded-full bg-signal px-1 text-xs text-ink">
                {extraCount}
              </span>
            )}
          </button>
        </div>

        <div
          id="filtros-extra"
          className={cn(
            isExpanded ? "grid max-md:animate-drop" : "hidden",
            "grid-cols-2 gap-3 md:col-span-3 md:grid md:grid-cols-3",
          )}
        >
          <div className="col-span-2 md:col-span-1">
            <Input
              label="Zona"
              id="filter-zone"
              type="text"
              autoComplete="off"
              placeholder="Ej: San Telmo…"
              value={zone}
              onChange={(e) => onZoneChange(e.target.value)}
            />
          </div>
          <Input
            label="Desde"
            id="filter-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
          <Input
            label="Hasta"
            id="filter-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
