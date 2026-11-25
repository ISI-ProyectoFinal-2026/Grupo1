import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { postLoginPath } from "@/lib/redirect";

// Mirror of ProtectedRoute: pages that only make sense without a session
// (login, register) send an authenticated user back home.
function GuestOnlyRoute() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (token) {
    // mismo destino que el login, para no competir con su navigate (#187)
    return <Navigate to={postLoginPath(location.state)} replace />;
  }

  return <Outlet />;
}

export default GuestOnlyRoute;
