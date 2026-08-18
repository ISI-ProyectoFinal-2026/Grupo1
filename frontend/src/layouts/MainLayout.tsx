import { Outlet } from "react-router-dom";

function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <nav className="border-b border-gray-200 px-6 py-4">
        <span className="text-lg font-semibold text-gray-900">PATITAS</span>
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default MainLayout;
