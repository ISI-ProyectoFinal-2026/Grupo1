import axios, { type AxiosError } from "axios";
import { useAuthStore } from "@/stores/auth.store";
import type { ApiErrorDetail, ApiErrorResponse } from "@/types/auth";

const DEFAULT_ERROR_MESSAGE = "Error inesperado, intentá de nuevo";

// Páginas de links de email: ahí un 401 de una sesión vieja limpia la sesión
// pero no debe arrancar al usuario de la página hacia /login.
const LINK_FLOW_PATHS = ["/verify-email", "/forgot-password", "/reset-password"];

export interface ApiError extends Error {
  code?: string;
  details?: ApiErrorDetail[];
  status?: number;
}

export const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    // Solo el 401 cierra la sesión: un 403 (p. ej. EMAIL_NOT_VERIFIED) es una
    // sesión válida a la que le falta un paso, no una sesión vencida.
    if (error.response?.status === 401 && window.location.pathname !== "/login") {
      useAuthStore.getState().logout();
      if (!LINK_FLOW_PATHS.includes(window.location.pathname)) {
        window.location.href = "/login";
      }
    }

    const message = error.response?.data?.error?.message ?? DEFAULT_ERROR_MESSAGE;
    const details = error.response?.data?.error?.details;
    const code = error.response?.data?.error?.code;

    const apiError: ApiError = new Error(message);
    if (code) {
      apiError.code = code;
    }
    if (details) {
      apiError.details = details;
    }
    apiError.status = error.response?.status;
    return Promise.reject(apiError);
  },
);

export function getApiErrorCode(error: unknown): string | undefined {
  if (error instanceof Error && "code" in error) {
    return (error as ApiError).code;
  }
  return undefined;
}

export function getApiErrorDetails(error: unknown): ApiErrorDetail[] | undefined {
  if (error instanceof Error && "details" in error) {
    return (error as ApiError).details;
  }
  return undefined;
}

export function getApiErrorStatus(error: unknown): number | undefined {
  if (error instanceof Error && "status" in error) {
    return (error as ApiError).status;
  }
  return undefined;
}
