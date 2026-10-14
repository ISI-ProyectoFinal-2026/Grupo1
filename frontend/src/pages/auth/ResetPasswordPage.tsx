import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import AuthCard from "@/components/ui/AuthCard";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { useResetPassword } from "@/hooks/useResetPassword";
import { useUrlToken } from "@/hooks/useUrlToken";
import { getApiErrorDetails, getApiErrorStatus } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { getPasswordErrors } from "@/utils/password-rules";

const INVALID_LINK_MESSAGE = "El enlace es inválido o expiró";

function RequestNewLink() {
  return (
    <p className="mt-5 text-sm">
      <Link to="/forgot-password" className="font-bold text-ink underline underline-offset-4 hover:no-underline">
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
      <AuthCard title="Nueva contraseña">
        <ErrorMessage message={INVALID_LINK_MESSAGE} className="mt-4" />
        <RequestNewLink />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nueva contraseña">
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="field-label">
            Contraseña nueva
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
          />
          <p className="text-sm text-ink-muted">
            Mínimo 8 caracteres, con mayúscula, minúscula y número.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="field-label">
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="field"
          />
        </div>

        {fieldErrors.length > 0 && (
          <ul className="flex flex-col gap-1 border-l-4 border-danger pl-3 text-sm font-bold text-danger">
            {fieldErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {error && <ErrorMessage message={error} />}

        <button type="submit" disabled={isPending} className={buttonClasses("primary", "lg", "mt-2 w-full")}>
          {isPending ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>

      {linkRejected && <RequestNewLink />}
    </AuthCard>
  );
}

export default ResetPasswordPage;
