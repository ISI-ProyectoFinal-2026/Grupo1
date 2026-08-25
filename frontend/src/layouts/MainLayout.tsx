import { Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { Outlet } from 'react-router-dom'

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
        <span className="text-lg font-semibold text-gray-900">PATITAS</span>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">{user.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-gray-900 underline"
            >
              Cerrar sesión
            </button>
          </div>
        )}
    <div className='flex min-h-screen flex-col'>
      <nav className='border-b border-gray-200 px-6 py-4'>
        <span className='text-lg font-semibold text-gray-900'>PATITAS</span>
      </nav>
      <main className='flex-1'>
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout
