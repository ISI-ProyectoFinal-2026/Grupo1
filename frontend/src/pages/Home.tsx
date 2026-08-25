import { Link } from "react-router-dom";
import Button from "@/components/ui/Button";

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">🐾 PATITAS</h1>
        <p className="text-xl text-gray-700 mb-8">
          Ayudá a encontrar mascotas perdidas con matching automático visual
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-3xl mb-2">📸</h3>
            <h4 className="font-semibold text-gray-900 mb-2">Sube una foto</h4>
            <p className="text-gray-600 text-sm">
              Reportá tu mascota con una foto clara
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-3xl mb-2">🤖</h3>
            <h4 className="font-semibold text-gray-900 mb-2">IA detecta similitud</h4>
            <p className="text-gray-600 text-sm">
              Nuestro sistema busca matches automáticamente
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-3xl mb-2">💬</h3>
            <h4 className="font-semibold text-gray-900 mb-2">Conectá con otros</h4>
            <p className="text-gray-600 text-sm">
              Chateá con personas que encontraron tu mascota
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/reports">
            <Button variant="primary" size="lg">
              Ver Reportes
            </Button>
          </Link>
          <Link to="/reports/new">
            <Button variant="secondary" size="lg">
              Crear Reporte
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
