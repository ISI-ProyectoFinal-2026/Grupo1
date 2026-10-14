import { Link } from "react-router-dom";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { useAuthStore } from "@/stores/auth.store";

/** Salida de las páginas de links de email: sin sesión al login, con sesión al inicio. */
function LinkFlowExit() {
  const hasSession = useAuthStore((state) => state.token !== null);

  return (
    <p className="mt-6">
      {hasSession ? (
        <Link to="/" className={buttonClasses("secondary", "md", "w-full")}>
          Ir al inicio
        </Link>
      ) : (
        <Link to="/login" className={buttonClasses("secondary", "md", "w-full")}>
          Iniciar sesión
        </Link>
      )}
    </p>
  );
}

export default LinkFlowExit;
