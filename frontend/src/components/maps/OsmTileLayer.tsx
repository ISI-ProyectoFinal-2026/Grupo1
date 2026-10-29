import { TileLayer } from "react-leaflet";

// capa base de OpenStreetMap (ADR-0009)
export default function OsmTileLayer() {
  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    />
  );
}
