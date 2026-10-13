import type { FormEvent } from "react";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { formatResetDate } from "@/utils/two-factor";
import type { SecondFactorMode } from "@/utils/two-factor";

interface TwoFactorChallengeFormProps {
  mode: SecondFactorMode;
  code: string;
  isLoading: boolean;
  error: string | null;
  /** ISO de un reinicio de 2FA pendiente: avisa cuándo se completa y que un código válido lo cancela. */
  resetEffectiveAt?: string;
  onCodeChange: (code: string) => void;
  onModeChange: (mode: SecondFactorMode) => void;
  onSubmit: () => void;
  onLostAccess: () => void;
  onBack: () => void;
}

const TEXT_BUTTON_CLASS = "font-medium text-gray-900 underline";

function TwoFactorChallengeForm({
  mode,
  code,
  isLoading,
  error,
  resetEffectiveAt,
  onCodeChange,
  onModeChange,
  onSubmit,
  onLostAccess,
  onBack,
}: TwoFactorChallengeFormProps) {
  const isRecovery = mode === "recovery";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">Verificación en dos pasos</h1>

      {resetEffectiveAt && (
        <p
          role="status"
          className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          Hay un reinicio de la verificación en dos pasos en curso: se completa el{" "}
          {formatResetDate(resetEffectiveAt)}. Si ingresás un código válido ahora, el reinicio se
          cancela.
        </p>
      )}

      <p className="mt-4 text-sm text-gray-600">
        {isRecovery
          ? "Ingresá uno de tus códigos de recuperación. Cada uno se puede usar una sola vez."
          : "Ingresá el código de 6 dígitos que te muestra tu app de autenticación."}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="twoFactorCode" className="text-sm font-medium text-gray-700">
            {isRecovery ? "Código de recuperación" : "Código de verificación"}
          </label>
          <input
            id="twoFactorCode"
            type="text"
            required
            autoFocus
            spellCheck={false}
            inputMode={isRecovery ? "text" : "numeric"}
            autoComplete={isRecovery ? "off" : "one-time-code"}
            placeholder={isRecovery ? "XXXXX-XXXXX" : "123456"}
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 tracking-widest text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        {error && <ErrorMessage message={error} />}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Verificando..." : "Verificar"}
        </button>
      </form>

      <div className="mt-4 flex flex-col items-start gap-2 text-sm text-gray-600">
        <button
          type="button"
          onClick={() => onModeChange(isRecovery ? "totp" : "recovery")}
          className={TEXT_BUTTON_CLASS}
        >
          {isRecovery ? "Usar el código de mi app" : "Usar un código de recuperación"}
        </button>
        <button type="button" onClick={onLostAccess} className={TEXT_BUTTON_CLASS}>
          Perdí el acceso a mi autenticador
        </button>
        <button type="button" onClick={onBack} className={TEXT_BUTTON_CLASS}>
          Volver al inicio de sesión
        </button>
      </div>
    </>
  );
}

export default TwoFactorChallengeForm;
