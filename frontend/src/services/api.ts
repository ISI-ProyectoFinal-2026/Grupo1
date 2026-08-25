import axios, { type AxiosError } from "axios";
import { useAuthStore } from "@/stores/auth.store";
import type { ApiErrorDetail, ApiErrorResponse } from "@/types/auth";

const DEFAULT_ERROR_MESSAGE = "Error inesperado, intentá de nuevo";

export interface ApiError extends Error {
  details?: ApiErrorDetail[];
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
    if (
      error.response?.status === 401 &&
      window.location.pathname !== "/login"
    ) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }

    const message = error.response?.data?.error?.message ?? DEFAULT_ERROR_MESSAGE;
    const details = error.response?.data?.error?.details;

    const apiError: ApiError = new Error(message);
    if (details) {
      apiError.details = details;
    }
    return Promise.reject(apiError);
  },
);

export function getApiErrorDetails(error: unknown): ApiErrorDetail[] | undefined {
  if (error instanceof Error && "details" in error) {
    return (error as ApiError).details;
  }
  return undefined;
}
