import { useState, type ComponentType, type SVGProps } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import LocationConsentModal from "@/components/account/LocationConsentModal";
import UnverifiedEmailBanner from "@/components/auth/UnverifiedEmailBanner";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsModerator } from "@/hooks/useIsModerator";
import { useLocationSync } from "@/hooks/useLocationSync";
import { cn } from "@/lib/cn";
import {
  BellIcon,
  ChatIcon,
  LogoutIcon,
  MoreIcon,
  PawIcon,
  PlusIcon,
  ShieldIcon,
  StoreIcon,
  ListIcon,
  UserIcon,
} from "@/components/ui/icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItemConfig {
  to: string;
  label: string;
  icon: IconComponent;
  isActive: (pathname: string) => boolean;
}

// El match de cada item se resuelve a mano en lugar de con NavLink: /reports/new
// pertenece a "Reportar" (no a "Reportes") y /businesses/dashboard a "Mi comercio"
// (no a "Comercios"), cosa que el match por prefijo de NavLink no distingue.
const isReportsPath = (path: string) =>
  path === "/reports" || (path.startsWith("/reports/") && path !== "/reports/new");
const isOwnBusinessPath = (path: string) =>
  path === "/businesses/dashboard" || path === "/businesses/register";
const isOwnPetsPath = (path: string) => path === "/pets" || path.startsWith("/pets/");

const PRIMARY_ITEMS: NavItemConfig[] = [
  { to: "/reports", label: "Reportes", icon: ListIcon, isActive: isReportsPath },
  { to: "/chats", label: "Chats", icon: ChatIcon, isActive: (p) => p === "/chats" || p.startsWith("/chats/") },
];

const SECONDARY_ITEMS: NavItemConfig[] = [
  {
    to: "/businesses",
    label: "Comercios",
    icon: StoreIcon,
    isActive: (p) => (p === "/businesses" || p.startsWith("/businesses/")) && !isOwnBusinessPath(p),
  },
];

function Wordmark() {
  return (
    <Link
      to="/"
      translate="no"
      className="inline-flex min-h-11 items-center gap-2.5 rounded-control text-ink"
    >
      {/* Chapita de collar: argolla arriba */}
      <span className="relative grid h-9 w-9 -rotate-6 place-items-center rounded-full bg-signal text-ink">
        <span aria-hidden="true" className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-ink/70 bg-paper" />
        <PawIcon className="h-5 w-5" />
      </span>
      <span className="letra-filete text-[1.625rem] leading-none">PATITAS</span>
    </Link>
  );
}

function TabLink({ item, pathname, onNavigate }: { item: NavItemConfig; pathname: string; onNavigate: () => void }) {
  const active = item.isActive(pathname);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-full min-h-11 flex-col items-center justify-center gap-0.5 rounded-control px-1 text-xs font-bold transition-colors duration-fast",
        "lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-base",
        active ? "text-signal-ink lg:bg-signal-soft" : "text-ink-muted hover:text-ink lg:hover:bg-ink/5",
      )}
    >
      <span
        className={cn(
          "grid h-7 w-12 place-items-center rounded-full transition-[background-color,transform] duration-press ease-out group-active:scale-90 lg:h-auto lg:w-auto lg:group-active:scale-100",
          active && "bg-signal-track lg:bg-transparent",
        )}
      >
        <Icon className="h-[22px] w-[22px]" />
      </span>
      {item.label}
    </Link>
  );
}

function MainLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isModerator = useIsModerator();
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

  const closeMore = () => setIsMoreOpen(false);
  const isReportarActive = pathname === "/reports/new";
  const isMoreActive =
    isOwnPetsPath(pathname) ||
    isOwnBusinessPath(pathname) ||
    pathname === "/moderation" ||
    pathname === "/account/security" ||
    pathname === "/account/notifications";

  const moreLinkClasses = (active: boolean) =>
    cn(
      "press flex min-h-12 items-center gap-3 rounded-control px-3 text-base font-bold lg:min-h-11",
      active ? "bg-signal-soft text-signal-ink" : "text-ink-muted hover:bg-ink/5 hover:text-ink",
    );

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
          <ul className="relative mx-auto grid h-tabbar bg-paper max-w-lg grid-cols-5 items-stretch px-1 lg:mx-0 lg:flex lg:h-auto lg:max-w-none lg:flex-col lg:gap-1 lg:p-3">
            {PRIMARY_ITEMS.map((item) => (
              <li key={item.to}>
                <TabLink item={item} pathname={pathname} onNavigate={closeMore} />
              </li>
            ))}

            <li className="flex justify-center lg:order-first lg:mb-3 lg:block">
              <Link
                to="/reports/new"
                onClick={closeMore}
                aria-current={isReportarActive ? "page" : undefined}
                className={cn(
                  "group flex h-full flex-col items-center justify-center gap-0.5 text-xs font-bold text-ink",
                  "lg:press lg:h-auto lg:min-h-12 lg:flex-row lg:gap-2 lg:rounded-full lg:bg-signal lg:px-4 lg:text-base lg:hover:bg-signal-deep",
                )}
              >
                <span className="-my-1 grid h-10 w-12 place-items-center rounded-full bg-signal ring-4 ring-paper transition-transform duration-press ease-out group-active:scale-90 lg:my-0 lg:h-auto lg:w-auto lg:bg-transparent lg:ring-0 lg:group-active:scale-100">
                  <PlusIcon className="h-6 w-6 lg:h-5 lg:w-5" strokeWidth={2.5} />
                </span>
                Reportar
              </Link>
            </li>

            {SECONDARY_ITEMS.map((item) => (
              <li key={item.to}>
                <TabLink item={item} pathname={pathname} onNavigate={closeMore} />
              </li>
            ))}

            <li className="lg:hidden">
              <button
                type="button"
                aria-expanded={isMoreOpen}
                aria-controls="menu-mas"
                onClick={() => setIsMoreOpen((open) => !open)}
                className={cn(
                  "group flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-control text-xs font-bold transition-colors duration-fast",
                  isMoreActive || isMoreOpen ? "text-signal-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-[background-color,transform] duration-press ease-out group-active:scale-90",
                    (isMoreActive || isMoreOpen) && "bg-signal-track",
                  )}
                >
                  <MoreIcon className="h-[22px] w-[22px]" />
                </span>
                Más
              </button>
            </li>
          </ul>

          {isMoreOpen && (
            <button
              type="button"
              aria-label="Cerrar menú"
              tabIndex={-1}
              onClick={closeMore}
              className="fixed inset-0 -z-10 animate-fade bg-ink/40 lg:hidden"
            />
          )}

          {/* Mismo bloque en ambos tamaños: hoja inferior en mobile (se abre con
              "Más") y pie del sidebar en desktop, siempre visible. */}
          <div
            id="menu-mas"
            className={cn(
              isMoreOpen ? "flex" : "hidden",
              "fixed inset-x-0 bottom-above-tabbar flex-col gap-1 overscroll-contain rounded-t-card border-t border-line bg-paper p-3 shadow-sheet",
              isMoreOpen && "max-lg:animate-sheet",
              "lg:static lg:mt-auto lg:flex lg:rounded-none lg:shadow-none",
            )}
          >
            <Link
              to="/pets"
              onClick={closeMore}
              aria-current={isOwnPetsPath(pathname) ? "page" : undefined}
              className={moreLinkClasses(isOwnPetsPath(pathname))}
            >
              <PawIcon className="h-5 w-5" />
              Mis mascotas
            </Link>
            <Link
              to="/businesses/dashboard"
              onClick={closeMore}
              aria-current={isOwnBusinessPath(pathname) ? "page" : undefined}
              className={moreLinkClasses(isOwnBusinessPath(pathname))}
            >
              <StoreIcon className="h-5 w-5" />
              Mi comercio
            </Link>
            {isModerator && (
              <Link
                to="/moderation"
                onClick={closeMore}
                aria-current={pathname === "/moderation" ? "page" : undefined}
                className={moreLinkClasses(pathname === "/moderation")}
              >
                <ShieldIcon className="h-5 w-5" />
                Moderación
              </Link>
            )}

            <div className="mt-2 flex flex-col border-t border-line pt-3">
              <Link
                to="/account/notifications"
                onClick={closeMore}
                aria-current={pathname === "/account/notifications" ? "page" : undefined}
                className={moreLinkClasses(pathname === "/account/notifications")}
              >
                <BellIcon className="h-5 w-5" />
                Notificaciones
              </Link>
              <Link
                to="/account/security"
                onClick={closeMore}
                aria-label={`Seguridad de la cuenta: ${user.email}`}
                aria-current={pathname === "/account/security" ? "page" : undefined}
                className={cn(moreLinkClasses(pathname === "/account/security"), "min-w-0 text-sm")}
              >
                <UserIcon className="h-5 w-5 shrink-0" />
                <span className="min-w-0 truncate" title={user.email}>
                  {user.email}
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="press mt-1 inline-flex min-h-11 items-center gap-3 rounded-control px-3 text-base font-bold text-ink hover:bg-ink/5"
              >
                <LogoutIcon className="h-5 w-5" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </nav>
      )}

      <main id="contenido" tabIndex={-1} className={cn("focus:outline-none", user && "pb-tabbar lg:pb-0 lg:pl-sidebar")}>
        <UnverifiedEmailBanner />
        <Outlet />
      </main>
      <LocationConsentModal />
    </div>
  );
}

export default MainLayout;
