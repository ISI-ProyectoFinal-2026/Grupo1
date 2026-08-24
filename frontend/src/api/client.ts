import axios, { type AxiosError } from "axios";
import { useAuthStore } from "@/stores/auth.store";
import type { ApiError } from "@/types";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  timeout: 10_000,
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      window.location.href = "/login";
    }
    const message = error.response?.data?.error?.message ?? "Error inesperado";
    return Promise.reject(new Error(message));
  }
);

export default client;
