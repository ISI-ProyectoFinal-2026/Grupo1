import { Outlet, useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import NotificationBell from "@/components/notifications/NotificationBell";

function MainLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  function handleLogout() {
    logout();
    // Limpiar el caché de queries evita que, en un navegador compartido, el
    // próximo usuario vea datos cacheados del anterior (['notifications'],
    // ['business','me'], ['chats']) durante el primer render antes del refetch.
    // El QueryClient vive una sola vez (main.tsx) y sobrevive al logout; el
    // camino de 401 ya lo evita con un reload duro (api.ts), pero el botón de
    // logout no recarga, así que hay que limpiar acá (issue #175).
    queryClient.clear();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <Link to="/" className="text-lg font-semibold text-gray-900 hover:text-blue-600">
          PATITAS
        </Link>
        {user && (
          <div className="flex items-center gap-4 text-sm">
            <Link to="/reports" className="text-gray-600 hover:text-gray-900">
              Reportes
            </Link>
            <Link to="/chats" className="text-gray-600 hover:text-gray-900">
              Chats
            </Link>
            <Link to="/businesses" className="text-gray-600 hover:text-gray-900">
              Comercios
            </Link>
            <Link to="/businesses/dashboard" className="text-gray-600 hover:text-gray-900">
              Mi comercio
            </Link>
            <NotificationBell />
            <span className="text-gray-600">{user.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-gray-900 hover:underline"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default MainLayout;
