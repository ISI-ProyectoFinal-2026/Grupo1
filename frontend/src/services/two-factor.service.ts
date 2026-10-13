import { api } from "@/services/api";
import type {
  AuthResponse,
  MessageResponse,
  TwoFactorLoginInput,
  TwoFactorResetConfirmResponse,
  TwoFactorResetRequestInput,
} from "@/types/auth";

// Público: el desafío del login es la única credencial de este paso.
export function loginWithTwoFactor(input: TwoFactorLoginInput): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/2fa/login", input).then((res) => res.data);
}

export function requestTwoFactorReset(input: TwoFactorResetRequestInput): Promise<MessageResponse> {
  return api.post<MessageResponse>("/auth/2fa/reset/request", input).then((res) => res.data);
}

export function confirmTwoFactorReset(token: string): Promise<TwoFactorResetConfirmResponse> {
  return api
    .post<TwoFactorResetConfirmResponse>("/auth/2fa/reset/confirm", { token })
    .then((res) => res.data);
}

export function cancelTwoFactorReset(token: string): Promise<MessageResponse> {
  return api.post<MessageResponse>("/auth/2fa/reset/cancel", { token }).then((res) => res.data);
}
