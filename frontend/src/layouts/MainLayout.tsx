import { Outlet, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";

function MainLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  function handleLogout() {
    logout();
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
