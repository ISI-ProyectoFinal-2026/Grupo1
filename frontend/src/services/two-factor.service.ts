import { api } from "@/services/api";
import type {
  AuthResponse,
  MessageResponse,
  RecoveryCodesResponse,
  TwoFactorDisableInput,
  TwoFactorEnableInput,
  TwoFactorLoginInput,
  TwoFactorRegenerateInput,
  TwoFactorResetConfirmResponse,
  TwoFactorResetRequestInput,
  TwoFactorSetup,
  TwoFactorStatus,
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

export function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  return api.get<TwoFactorStatus>("/auth/2fa/status").then((res) => res.data);
}

export function setupTwoFactor(): Promise<TwoFactorSetup> {
  return api.post<TwoFactorSetup>("/auth/2fa/setup").then((res) => res.data);
}

export function enableTwoFactor(input: TwoFactorEnableInput): Promise<RecoveryCodesResponse> {
  return api.post<RecoveryCodesResponse>("/auth/2fa/enable", input).then((res) => res.data);
}

export function disableTwoFactor(input: TwoFactorDisableInput): Promise<AuthResponse> {
  return api.post<AuthResponse>("/auth/2fa/disable", input).then((res) => res.data);
}

export function regenerateRecoveryCodes(
  input: TwoFactorRegenerateInput,
): Promise<RecoveryCodesResponse> {
  return api.post<RecoveryCodesResponse>("/auth/2fa/recovery-codes", input).then((res) => res.data);
}
