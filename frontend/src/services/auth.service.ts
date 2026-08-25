import { api } from "@/services/api";
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from "@/types/auth";

export function login(input: LoginInput): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/login", input).then((res) => res.data);
}

export function register(input: RegisterInput): Promise<AuthUser> {
  return api.post<AuthUser>("/auth/register", input).then((res) => res.data);
}
