import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import AuthCard from "@/components/ui/AuthCard";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { CheckIcon } from "@/components/ui/icons";
import { useForgotPassword } from "@/hooks/useForgotPassword";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const { mutate, isPending, isSuccess, data, isError, error } = useForgotPassword();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutate(email);
  }

  return (
    <AuthCard
      title="Recuperar contraseña"
      footer={
        <Link to="/login" className="font-bold text-ink underline underline-offset-4 hover:no-underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      {isSuccess ? (
        // Mensaje del backend, igual exista o no la cuenta.
        <p className="mt-5 flex items-start gap-2 rounded-control bg-success-soft px-3 py-2.5 text-sm font-bold text-success-ink">
          <CheckIcon className="h-5 w-5 shrink-0" />
          <span>{data.message}</span>
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input
              id="email"
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

          {isError && <ErrorMessage message={error.message} />}

          <button type="submit" disabled={isPending} className={buttonClasses("primary", "lg", "mt-2 w-full")}>
            {isPending ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export default ForgotPasswordPage;
