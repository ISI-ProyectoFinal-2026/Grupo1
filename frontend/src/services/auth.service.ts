import { api } from "./api";
import type { AuthResponse, LoginInput, RegisterInput, User } from "../types/user";

export async function login(input: LoginInput): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", input);
  return data;
}

export async function register(input: RegisterInput): Promise<User> {
  const { data } = await api.post<User>("/auth/register", input);
  return data;
}
