import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "@/services/auth.service";
import { getApiErrorDetails } from "@/services/api";
import AuthCard from "@/components/ui/AuthCard";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { getPasswordErrors } from "@/utils/password-rules";

function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors([]);

    const passwordErrors = getPasswordErrors(password);
    if (passwordErrors.length > 0) {
      setFieldErrors(passwordErrors.map((message) => `La contraseña necesita ${message}`));
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors(["Las contraseñas no coinciden"]);
      return;
    }

    setIsLoading(true);
    try {
      await register({ email, password });
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      const details = getApiErrorDetails(err);
      if (details && details.length > 0) {
        setFieldErrors(details.map((detail) => detail.message));
      } else {
        setError(err instanceof Error ? err.message : "Error inesperado, intentá de nuevo");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthCard
      title="Crear cuenta"
      subtitle="Sumate a la red de vecinos que buscan mascotas."
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="font-bold text-ink underline underline-offset-4 hover:no-underline">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="field-label">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="field-label">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-describedby="password-hint"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
          />
          <p id="password-hint" className="text-sm text-ink-muted">
            Mínimo 8 caracteres, con mayúscula, minúscula y número.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="field-label">
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="field"
          />
        </div>

        {fieldErrors.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1 border-l-4 border-danger pl-3 text-sm font-bold text-danger">
            {fieldErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {error && <ErrorMessage message={error} />}

        <button type="submit" disabled={isLoading} className={buttonClasses("primary", "lg", "mt-2 w-full")}>
          {isLoading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </AuthCard>
  );
}

export default Register;
