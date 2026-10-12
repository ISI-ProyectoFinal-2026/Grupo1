import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { useForgotPassword } from "@/hooks/useForgotPassword";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const { mutate, isPending, isSuccess, data, isError, error } = useForgotPassword();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutate(email);
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Recuperar contraseña</h1>

        {isSuccess ? (
          // Mensaje del backend, igual exista o no la cuenta.
          <p className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {data.message}
          </p>
        ) : (
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

            {isError && <ErrorMessage message={error.message} />}

            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-gray-600">
          <Link to="/login" className="font-medium text-gray-900 underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
