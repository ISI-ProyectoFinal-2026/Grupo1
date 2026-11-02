import { divIcon } from "leaflet";
import { PIN_HEIGHT, PIN_WIDTH, pinSvg } from "@/components/reports/reportPinIcon";

// verde (token success): distingue al comercio de los reportes
export const BUSINESS_PIN_COLOR = "#1F7A4D";

// creado una sola vez: Leaflet lo reutiliza entre markers
export const businessPinIcon = divIcon({
  html: pinSvg(BUSINESS_PIN_COLOR),
  className: "report-pin report-pin--business",
  iconSize: [PIN_WIDTH, PIN_HEIGHT],
  iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT],
  popupAnchor: [0, -PIN_HEIGHT],
});
