import type { FormEvent } from "react";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { CheckIcon } from "@/components/ui/icons";

interface TwoFactorResetRequestFormProps {
  password: string;
  isLoading: boolean;
  error: string | null;
  /** Confirmación del backend una vez enviado el email: reemplaza al formulario. */
  sentMessage: string | null;
  onPasswordChange: (password: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

function TwoFactorResetRequestForm({
  password,
  isLoading,
  error,
  sentMessage,
  onPasswordChange,
  onSubmit,
  onBack,
}: TwoFactorResetRequestFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <>
      <h1 className="font-display text-display-md">Recuperar el acceso</h1>

      <p className="mt-2 text-ink-muted">
        Si no tenés tu autenticador ni tus códigos de recuperación, podés pedir un reinicio. Te
        mandamos un email para confirmarlo y, al confirmarlo, empieza una espera de 72 horas: pasado
        ese tiempo vas a poder entrar solo con tu contraseña, con la verificación en dos pasos
        desactivada. Si en ese tiempo ingresás con un código válido o lo cancelás desde el email, el
        reinicio se anula.
      </p>

      {sentMessage ? (
        <p
          role="status"
          className="mt-5 flex items-start gap-2 rounded-control bg-success-soft px-3 py-2.5 text-sm font-bold text-success-ink"
        >
          <CheckIcon className="h-5 w-5 shrink-0" />
          <span>{sentMessage}</span>
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="resetPassword" className="field-label">
              Contraseña
            </label>
            <input
              id="resetPassword"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              className="field"
            />
          </div>

          {error && <ErrorMessage message={error} />}

          <button type="submit" disabled={isLoading} className={buttonClasses("primary", "lg", "mt-2 w-full")}>
            {isLoading ? "Enviando..." : "Enviar email de confirmación"}
          </button>
        </form>
      )}

      <p className="mt-5 border-t border-line pt-4 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center font-bold text-ink underline underline-offset-4 hover:no-underline"
        >
          Volver a ingresar el código
        </button>
      </p>
    </>
  );
}

export default TwoFactorResetRequestForm;
