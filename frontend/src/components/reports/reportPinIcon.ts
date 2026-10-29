import { divIcon } from "leaflet";
import type { DivIcon } from "leaflet";
import type { ReportType } from "@/types/report.types";

// Perdido en rojo (token danger), encontrado en azul.
export const PIN_COLORS: Record<ReportType, string> = {
  lost: "#C4342B",
  found: "#2457A6",
};

const PIN_WIDTH = 30;
const PIN_HEIGHT = 40;

function pinSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_WIDTH}" height="${PIN_HEIGHT}" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 1C7.3 1 1 7.3 1 15c0 10.5 14 24 14 24s14-13.5 14-24C29 7.3 22.7 1 15 1z" fill="${color}" stroke="#FFFFFF" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#FFFFFF"/></svg>`;
}

// iconos creados una sola vez: Leaflet los reutiliza entre markers
const ICONS: Record<ReportType, DivIcon> = {
  lost: divIcon({
    html: pinSvg(PIN_COLORS.lost),
    className: "report-pin report-pin--lost",
    iconSize: [PIN_WIDTH, PIN_HEIGHT],
    iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
    popupAnchor: [0, -PIN_HEIGHT],
  }),
  found: divIcon({
    html: pinSvg(PIN_COLORS.found),
    className: "report-pin report-pin--found",
    iconSize: [PIN_WIDTH, PIN_HEIGHT],
    iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
    popupAnchor: [0, -PIN_HEIGHT],
  }),
};

export function getReportPinIcon(reportType: ReportType): DivIcon {
  return ICONS[reportType];
}
