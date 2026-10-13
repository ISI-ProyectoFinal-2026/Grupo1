import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";

/** Salida de las páginas de links de email: sin sesión al login, con sesión al inicio. */
function LinkFlowExit() {
  const hasSession = useAuthStore((state) => state.token !== null);

  return (
    <p className="mt-4 text-sm">
      {hasSession ? (
        <Link to="/" className="font-medium text-gray-900 underline">
          Ir al inicio
        </Link>
      ) : (
        <Link to="/login" className="font-medium text-gray-900 underline">
          Iniciar sesión
        </Link>
      )}
    </p>
  );
}

export default LinkFlowExit;
