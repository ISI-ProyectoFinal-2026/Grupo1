import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "@/services/auth.service";
import { getApiErrorDetails } from "@/services/api";

const PASSWORD_RULES: Array<{ test: (value: string) => boolean; message: string }> = [
  { test: (value) => value.length >= 8, message: "mínimo 8 caracteres" },
  { test: (value) => /[a-z]/.test(value), message: "al menos una minúscula" },
  { test: (value) => /[A-Z]/.test(value), message: "al menos una mayúscula" },
  { test: (value) => /[0-9]/.test(value), message: "al menos un número" },
];

function getPasswordErrors(password: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.message);
}

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
    <div className="p-6">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>

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

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-600">
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="font-medium text-gray-900 underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
