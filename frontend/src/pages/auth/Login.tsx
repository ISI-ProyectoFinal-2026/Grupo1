import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const registered = Boolean(
    (location.state as { registered?: boolean } | null)?.registered,
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { token, user } = await login({ email, password });
      useAuthStore.getState().setAuth(token, user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado, intentá de nuevo");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Iniciar sesión</h1>

        {registered && (
          <p className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Cuenta creada, iniciá sesión
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
