import type { FormEvent } from "react";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { buttonClasses } from "@/components/ui/buttonClasses";
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

const TEXT_BUTTON_CLASS =
  "inline-flex min-h-11 items-center text-left font-bold text-ink underline underline-offset-4 hover:no-underline";

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
      <h1 className="font-display text-display-md">Verificación en dos pasos</h1>

      {resetEffectiveAt && (
        <p
          role="status"
          className="mt-5 rounded-card border border-signal bg-signal/15 p-4 text-sm text-ink"
        >
          Hay un reinicio de la verificación en dos pasos en curso: se completa el{" "}
          {formatResetDate(resetEffectiveAt)}. Si ingresás un código válido ahora, el reinicio se
          cancela.
        </p>
      )}

      <p className="mt-2 text-ink-muted">
        {isRecovery
          ? "Ingresá uno de tus códigos de recuperación. Cada uno se puede usar una sola vez."
          : "Ingresá el código de 6 dígitos que te muestra tu app de autenticación."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="twoFactorCode" className="field-label">
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
            className="field tabular text-center font-bold tracking-widest"
          />
        </div>

        {error && <ErrorMessage message={error} />}

        <button type="submit" disabled={isLoading} className={buttonClasses("primary", "lg", "mt-2 w-full")}>
          {isLoading ? "Verificando..." : "Verificar"}
        </button>
      </form>

      <div className="mt-5 flex flex-col items-start gap-1 border-t border-line pt-4 text-sm">
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
