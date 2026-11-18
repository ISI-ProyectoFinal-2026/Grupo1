import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { toRedirectFrom } from "@/utils/redirect";

function ProtectedRoute() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    // el login vuelve acá al iniciar sesión (#187)
    return <Navigate to="/login" replace state={toRedirectFrom(location)} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
