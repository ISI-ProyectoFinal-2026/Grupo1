import type { ReportType } from "@/types/report.types";
import InputBasic from "@/components/ui/InputBasic";

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
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <h3 className="font-semibold text-gray-900 mb-4">Filtros</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="filter-type" className="text-sm font-medium text-gray-700">
            Tipo
          </label>
          <select
            id="filter-type"
            value={type}
            onChange={(e) => onTypeChange((e.target.value as ReportType) || "")}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="lost">Perdidas</option>
            <option value="found">Encontradas</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-zone" className="text-sm font-medium text-gray-700">
            Zona
          </label>
          <InputBasic
            id="filter-zone"
            type="text"
            placeholder="Ej: San Telmo"
            value={zone}
            onChange={(e) => onZoneChange(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-date-from" className="text-sm font-medium text-gray-700">
            Desde
          </label>
          <InputBasic
            id="filter-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="filter-date-to" className="text-sm font-medium text-gray-700">
            Hasta
          </label>
          <InputBasic
            id="filter-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
