import { useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import LocationConsentModal from "@/components/account/LocationConsentModal";
import UnverifiedEmailBanner from "@/components/auth/UnverifiedEmailBanner";
import NotificationBell from "@/components/notifications/NotificationBell";
import RoleHelp from "@/components/help/RoleHelp";
import Wordmark from "@/components/navigation/Wordmark";
import MobileTabBar from "@/components/navigation/MobileTabBar";
import MoreSheet from "@/components/navigation/MoreSheet";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { toRedirectFrom } from "@/lib/redirect";
import { useLocationSync } from "@/hooks/useLocationSync";
import { cn } from "@/lib/cn";
import { isAuthFormPath, isPublicBrowsePath } from "@/layouts/navItems";

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  // Mantiene sincronizado `emailVerifiedAt` con el backend (ver el hook).
  useCurrentUser();
  // Actualiza la ubicación una vez por apertura si la persona la aceptó.
  useLocationSync();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  // Navigating from outside the sheet (bell, links in the page) must close it too.
  const [sheetPathname, setSheetPathname] = useState(pathname);
  if (sheetPathname !== pathname) {
    setSheetPathname(pathname);
    setIsMoreOpen(false);
  }

  function handleLogout() {
    setIsMoreOpen(false);
    // Navegar antes de limpiar la sesión: si el token cae primero, ProtectedRoute
    // redirige a /login con state.from y el login vuelve a la ruta protegida.
    navigate("/login", { replace: true });
    setTimeout(logout);
    // Limpiar el caché de queries evita que, en un navegador compartido, el
    // próximo usuario vea datos cacheados del anterior (['notifications'],
    // ['business','me'], ['chats']) durante el primer render antes del refetch.
    // El QueryClient vive una sola vez (lib/query-client.ts) y sobrevive al
    // logout; el camino de 401 lo limpia en api.ts y el botón de logout acá
    // (issue #175).
    queryClient.clear();
  }

  const closeMore = () => setIsMoreOpen(false);

  return (
    <div className="min-h-screen">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-control bg-ink px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Saltar al contenido
      </a>

      <header
        className={cn(
          "z-30 flex h-header items-center justify-between gap-3 px-4",
          user
            ? "sticky top-0 border-b border-line bg-paper lg:fixed lg:z-40 lg:left-0 lg:w-sidebar lg:border-r lg:px-5"
            : "mx-auto max-w-5xl sm:px-6",
        )}
      >
        <Wordmark />
        {user && <NotificationBell />}
        {/* visitante en una página pública (feed, detalle, comercios) (#187) */}
        {!user && !isAuthFormPath(pathname) && (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              state={isPublicBrowsePath(pathname) ? toRedirectFrom(location) : undefined}
              className={buttonClasses("ghost", "sm")}
            >
              Ingresar
            </Link>
            <Link to="/register" className={buttonClasses("signal", "sm", "hidden sm:inline-flex")}>
              Crear cuenta
            </Link>
          </div>
        )}
      </header>

      {user && (
        <nav
          aria-label="Navegación principal"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeMore();
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-safe",
            "lg:bottom-0 lg:right-auto lg:top-header lg:flex lg:w-sidebar lg:flex-col lg:border-r lg:border-t-0 lg:pb-0",
          )}
        >
          <MobileTabBar
            pathname={pathname}
            isMoreOpen={isMoreOpen}
            onToggleMore={() => setIsMoreOpen((open) => !open)}
            onNavigate={closeMore}
          />
          <MoreSheet
            pathname={pathname}
            isOpen={isMoreOpen}
            email={user.email}
            onClose={closeMore}
            onLogout={handleLogout}
          />
        </nav>
      )}

      <main id="contenido" tabIndex={-1} className={cn("focus:outline-none", user && "pb-tabbar lg:pb-0 lg:pl-sidebar")}>
        <UnverifiedEmailBanner />
        <Outlet />
      </main>
      <RoleHelp
        raised={pathname === "/chats" || pathname.startsWith("/chats/")}
      />
      <LocationConsentModal />
    </div>
  );
}

export default MainLayout;
