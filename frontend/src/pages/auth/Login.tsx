import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import TwoFactorChallengeForm from "@/components/auth/TwoFactorChallengeForm";
import TwoFactorResetRequestForm from "@/components/auth/TwoFactorResetRequestForm";
import { getApiErrorCode } from "@/services/api";
import { login } from "@/services/auth.service";
import { loginWithTwoFactor, requestTwoFactorReset } from "@/services/two-factor.service";
import { useAuthStore } from "@/stores/auth.store";
import { isTwoFactorChallenge, TWO_FACTOR_CHALLENGE_INVALID, TWO_FACTOR_LOCKED } from "@/types/auth";
import type { AuthUser } from "@/types/auth";
import {
  formatWaitMessage,
  getRetryAfterSeconds,
  normalizeSecondFactorCode,
} from "@/utils/two-factor";
import type { SecondFactorMode } from "@/utils/two-factor";

const DEFAULT_ERROR_MESSAGE = "Error inesperado, intentá de nuevo";

// El desafío del segundo paso es una credencial a medias: vive solo en este
// state, nunca en la URL ni en el store persistido.
type Step =
  | { kind: "password" }
  | { kind: "challenge"; token: string; resetEffectiveAt?: string }
  | { kind: "lost"; token: string; resetEffectiveAt?: string };

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : DEFAULT_ERROR_MESSAGE;
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  // Los avisos viajan en el state de la navegación de la página anterior
  // (Register, VerifyEmailPage, ResetPasswordPage), no en la URL.
  const flash = location.state as {
    registered?: boolean;
    emailVerified?: boolean;
    passwordReset?: boolean;
  } | null;
  const registered = Boolean(flash?.registered);
  const emailVerified = Boolean(flash?.emailVerified);
  const passwordReset = Boolean(flash?.passwordReset);

  const [step, setStep] = useState<Step>({ kind: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<SecondFactorMode>("totp");
  const [resetPassword, setResetPassword] = useState("");
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startSession(token: string, user: AuthUser) {
    useAuthStore.getState().setAuth(token, user);
    navigate("/", { replace: true });
  }

  function backToPassword(message: string | null) {
    setStep({ kind: "password" });
    setCode("");
    setMode("totp");
    setResetPassword("");
    setSentMessage(null);
    setError(message);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await login({ email, password });
      if (isTwoFactorChallenge(response)) {
        setPassword("");
        setStep({
          kind: "challenge",
          token: response.twoFactorToken,
          resetEffectiveAt: response.resetEffectiveAt,
        });
        return;
      }
      startSession(response.token, response.user);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCodeSubmit() {
    if (step.kind !== "challenge") return;
    setError(null);
    setIsLoading(true);

    try {
      const { token, user } = await loginWithTwoFactor({
        twoFactorToken: step.token,
        code: normalizeSecondFactorCode(mode, code),
      });
      startSession(token, user);
    } catch (err) {
      const errorCode = getApiErrorCode(err);
      if (errorCode === TWO_FACTOR_CHALLENGE_INVALID) {
        backToPassword(messageOf(err));
      } else if (errorCode === TWO_FACTOR_LOCKED) {
        // El desafío se conserva: el bloqueo es de la cuenta, no de este intento.
        const waitSeconds = getRetryAfterSeconds(err);
        setError(
          waitSeconds
            ? `Demasiados intentos fallidos. ${formatWaitMessage(waitSeconds)}`
            : messageOf(err),
        );
      } else {
        setError(messageOf(err));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetRequest() {
    if (step.kind !== "lost") return;
    setError(null);
    setIsLoading(true);

    try {
      const { message } = await requestTwoFactorReset({
        twoFactorToken: step.token,
        password: resetPassword,
      });
      setResetPassword("");
      setSentMessage(message);
    } catch (err) {
      if (getApiErrorCode(err) === TWO_FACTOR_CHALLENGE_INVALID) {
        backToPassword(messageOf(err));
      } else {
        setError(messageOf(err));
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleModeChange(nextMode: SecondFactorMode) {
    setMode(nextMode);
    setCode("");
    setError(null);
  }

  function openLostAccess() {
    if (step.kind !== "challenge") return;
    setError(null);
    setStep({ kind: "lost", token: step.token, resetEffectiveAt: step.resetEffectiveAt });
  }

  function backToChallenge() {
    if (step.kind !== "lost") return;
    setError(null);
    setResetPassword("");
    setSentMessage(null);
    setStep({ kind: "challenge", token: step.token, resetEffectiveAt: step.resetEffectiveAt });
  }

  if (step.kind === "challenge") {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-sm">
          <TwoFactorChallengeForm
            mode={mode}
            code={code}
            isLoading={isLoading}
            error={error}
            resetEffectiveAt={step.resetEffectiveAt}
            onCodeChange={setCode}
            onModeChange={handleModeChange}
            onSubmit={handleCodeSubmit}
            onLostAccess={openLostAccess}
            onBack={() => backToPassword(null)}
          />
        </div>
      </div>
    );
  }

  if (step.kind === "lost") {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-sm">
          <TwoFactorResetRequestForm
            password={resetPassword}
            isLoading={isLoading}
            error={error}
            sentMessage={sentMessage}
            onPasswordChange={setResetPassword}
            onSubmit={handleResetRequest}
            onBack={backToChallenge}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Iniciar sesión</h1>

        {registered && (
          <p className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Cuenta creada. Te enviamos un email para verificarla, revisá tu casilla e iniciá sesión
          </p>
        )}

        {emailVerified && (
          <p className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Tu email quedó verificado, iniciá sesión
          </p>
        )}

        {passwordReset && (
          <p className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Tu contraseña se actualizó, iniciá sesión con la nueva
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-600">
          <Link to="/forgot-password" className="font-medium text-gray-900 underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>

        <p className="mt-2 text-sm text-gray-600">
          ¿No tenés cuenta?{" "}
          <Link to="/register" className="font-medium text-gray-900 underline">
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
