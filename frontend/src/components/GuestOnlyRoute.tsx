import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";

// Mirror of ProtectedRoute: pages that only make sense without a session
// (login, register) send an authenticated user back home.
function GuestOnlyRoute() {
  const token = useAuthStore((state) => state.token);

  if (token) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default GuestOnlyRoute;
