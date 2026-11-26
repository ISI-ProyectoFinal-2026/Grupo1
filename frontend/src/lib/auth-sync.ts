import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth.store";

const AUTH_KEY = "patitas-auth";

// token persistido en el valor del evento; undefined si no se puede leer
function parseToken(value: string | null): string | null | undefined {
  if (value === null) return null;
  try {
    return JSON.parse(value)?.state?.token ?? null;
  } catch {
    return undefined;
  }
}

// sincroniza la sesión con los cambios hechos en otra pestaña
export function handleAuthStorageEvent(event: StorageEvent): void {
  if (event.key !== AUTH_KEY) return;
  const next = parseToken(event.newValue);
  if (next === undefined || next === useAuthStore.getState().token) return;

  if (next === null) {
    useAuthStore.getState().logout();
  } else {
    void useAuthStore.persist.rehydrate();
  }
  queryClient.clear();
}

export function startAuthSync(): () => void {
  window.addEventListener("storage", handleAuthStorageEvent);
  return () => window.removeEventListener("storage", handleAuthStorageEvent);
}
