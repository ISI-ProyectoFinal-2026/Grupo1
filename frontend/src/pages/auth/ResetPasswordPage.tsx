import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useResetPassword } from "@/hooks/useResetPassword";
import { useUrlToken } from "@/hooks/useUrlToken";
import { getApiErrorDetails, getApiErrorStatus } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { getPasswordErrors } from "@/utils/password-rules";

const INVALID_LINK_MESSAGE = "El enlace es inválido o expiró";

function RequestNewLink() {
  return (
    <p className="mt-4 text-sm text-gray-600">
      <Link to="/forgot-password" className="font-medium text-gray-900 underline">
        Pedir un enlace nuevo
      </Link>
    </p>
  );
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useUrlToken();
  const { mutateAsync: reset, isPending } = useResetPassword();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [linkRejected, setLinkRejected] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setFieldErrors([]);
    setLinkRejected(false);

    const passwordErrors = getPasswordErrors(password);
    if (passwordErrors.length > 0) {
      setFieldErrors(passwordErrors.map((message) => `La contraseña necesita ${message}`));
      return;
    }
    if (password !== confirmPassword) {
      setFieldErrors(["Las contraseñas no coinciden"]);
      return;
    }

    try {
      await reset({ token, password });
    } catch (err) {
      const details = getApiErrorDetails(err);
      if (details && details.length > 0) {
        setFieldErrors(details.map((detail) => detail.message));
      } else {
        setError(err instanceof Error ? err.message : "Error inesperado, intentá de nuevo");
        setLinkRejected(getApiErrorStatus(err) === 400);
      }
      return;
    }

    // El reset sube la tokenVersion: toda sesión anterior queda muerta en el
    // backend. Se cierra también acá, y se limpia el cache para que otra cuenta
    // en el mismo navegador no vea datos de la anterior.
    useAuthStore.getState().logout();
    queryClient.clear();
    navigate("/login", { replace: true, state: { passwordReset: true } });
  }

  if (!token) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900">Nueva contraseña</h1>
          <ErrorMessage message={INVALID_LINK_MESSAGE} className="mt-4" />
          <RequestNewLink />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Nueva contraseña</h1>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Contraseña nueva
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
            />
            <p className="text-xs text-gray-500">
              Mínimo 8 caracteres, con mayúscula, minúscula y número.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
            />
          </div>

          {fieldErrors.length > 0 && (
            <ul className="list-inside list-disc text-sm text-red-600">
              {fieldErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          {error && <ErrorMessage message={error} />}

          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>

        {linkRejected && <RequestNewLink />}
      </div>
    </div>
  );
}

export default ResetPasswordPage;
