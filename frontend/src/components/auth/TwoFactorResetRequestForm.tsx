import type { FormEvent } from "react";
import ErrorMessage from "@/components/ui/ErrorMessage";

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
      <h1 className="text-2xl font-bold text-gray-900">Recuperar el acceso</h1>

      <p className="mt-4 text-sm text-gray-600">
        Si no tenés tu autenticador ni tus códigos de recuperación, podés pedir un reinicio. Te
        mandamos un email para confirmarlo y, al confirmarlo, empieza una espera de 72 horas: pasado
        ese tiempo vas a poder entrar solo con tu contraseña, con la verificación en dos pasos
        desactivada. Si en ese tiempo ingresás con un código válido o lo cancelás desde el email, el
        reinicio se anula.
      </p>

      {sentMessage ? (
        <p
          role="status"
          className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
        >
          {sentMessage}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="resetPassword" className="text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="resetPassword"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
            />
          </div>

          {error && <ErrorMessage message={error} />}

          <button
            type="submit"
            disabled={isLoading}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Enviando..." : "Enviar email de confirmación"}
          </button>
        </form>
      )}

      <p className="mt-4 text-sm">
        <button type="button" onClick={onBack} className="font-medium text-gray-900 underline">
          Volver a ingresar el código
        </button>
      </p>
    </>
  );
}

export default TwoFactorResetRequestForm;
