import { api } from "@/services/api";
import type {
  AuthResponse,
  AuthUser,
  LoginInput,
  MessageResponse,
  RegisterInput,
  ResetPasswordInput,
} from "@/types/auth";

export function login(input: LoginInput): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/login", input).then((res) => res.data);
}

export function register(input: RegisterInput): Promise<AuthUser> {
  return api.post<AuthUser>("/auth/register", input).then((res) => res.data);
}

// GET /auth/me devuelve el usuario en la raíz del body, sin envolverlo.
export function getMe(): Promise<AuthUser> {
  return api.get<AuthUser>("/auth/me").then((res) => res.data);
}

export function verifyEmail(token: string): Promise<MessageResponse> {
  return api.post<MessageResponse>("/auth/verify-email", { token }).then((res) => res.data);
}

// Requiere sesión: el backend sabe a quién reenviar por el JWT, no por un email.
export function resendVerification(): Promise<MessageResponse> {
  return api.post<MessageResponse>("/auth/verify-email/resend").then((res) => res.data);
}

export function forgotPassword(email: string): Promise<MessageResponse> {
  return api.post<MessageResponse>("/auth/forgot-password", { email }).then((res) => res.data);
}

export function resetPassword(input: ResetPasswordInput): Promise<MessageResponse> {
  return api.post<MessageResponse>("/auth/reset-password", input).then((res) => res.data);
}
