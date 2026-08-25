import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import type { ReportDTO } from "@/types/report.types";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
  reports: ReportDTO[];
  center?: [number, number];
}

export default function MapView({
  reports,
  center = [-34.6037, -58.3816],
}: MapViewProps) {
  const navigate = useNavigate();

  const reportsWithLocation = reports.filter((r) => r.location);

  if (reportsWithLocation.length === 0) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-600">No hay reportes con ubicación para mostrar</p>
      </div>
    );
  }

  return (
    <MapContainer center={center} zoom={13} style={{ width: "100%", height: "384px", borderRadius: "8px" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {reportsWithLocation.map((report) => (
        <Marker
          key={report.id}
          position={[report.location!.lat, report.location!.lng]}
        >
          <Popup>
            <div className="flex flex-col gap-2 min-w-48">
              {report.imageUrl && (
                <img
                  src={report.imageUrl}
                  alt={report.title}
                  className="w-full h-32 object-cover rounded"
                />
              )}
              <h4 className="font-semibold text-gray-900">{report.title}</h4>
              <p className="text-sm text-gray-600 line-clamp-2">
                {report.description || "Sin descripción"}
              </p>
              <button
                onClick={() => navigate(`/reports/${report.id}`)}
                className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Ver detalles
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
