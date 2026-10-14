import { useState } from "react";
import type { FormEvent } from "react";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { normalizeSecondFactorCode } from "@/utils/two-factor";
import type { SecondFactorMode } from "@/utils/two-factor";

interface DisableTwoFactorFormProps {
  isLoading: boolean;
  error: string | null;
  onSubmit: (input: { password: string; code: string }) => void;
}

function DisableTwoFactorForm({ isLoading, error, onSubmit }: DisableTwoFactorFormProps) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<SecondFactorMode>("totp");
  const isRecovery = mode === "recovery";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ password, code: normalizeSecondFactorCode(mode, code) });
  }

  function toggleMode() {
    setMode(isRecovery ? "totp" : "recovery");
    setCode("");
  }

  return (
    <section
      aria-labelledby="disable-two-factor-title"
      className="card mt-4 p-4 sm:p-5"
    >
      <h3 id="disable-two-factor-title" className="font-display text-display-sm text-ink">
        Desactivar la verificación en dos pasos
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        Vas a volver a entrar solo con tu contraseña y se cierran tus otras sesiones abiertas. Para
        confirmar, ingresá tu contraseña y un código.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="disablePassword" className="field-label">
            Contraseña
          </label>
          <input
            id="disablePassword"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="disableCode" className="field-label">
            {isRecovery ? "Código de recuperación" : "Código de tu app"}
          </label>
          <input
            id="disableCode"
            type="text"
            required
            spellCheck={false}
            inputMode={isRecovery ? "text" : "numeric"}
            autoComplete={isRecovery ? "off" : "one-time-code"}
            placeholder={isRecovery ? "XXXXX-XXXXX" : "123456"}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="field tabular font-bold tracking-widest"
          />
        </div>

        {error && <ErrorMessage message={error} />}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            disabled={isLoading}
            className={buttonClasses("danger")}
          >
            {isLoading ? "Desactivando..." : "Desactivar verificación en dos pasos"}
          </button>
          <button
            type="button"
            onClick={toggleMode}
            className="inline-flex min-h-11 items-center font-bold text-ink underline underline-offset-4 hover:no-underline text-sm"
          >
            {isRecovery ? "Usar el código de mi app" : "Usar un código de recuperación"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default DisableTwoFactorForm;
