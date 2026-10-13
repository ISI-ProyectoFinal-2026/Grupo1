import { useState } from "react";
import type { FormEvent } from "react";
import ErrorMessage from "@/components/ui/ErrorMessage";
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
      className="mt-6 rounded border border-gray-200 p-4"
    >
      <h3 id="disable-two-factor-title" className="text-base font-semibold text-gray-900">
        Desactivar la verificación en dos pasos
      </h3>
      <p className="mt-2 text-sm text-gray-600">
        Vas a volver a entrar solo con tu contraseña y se cierran tus otras sesiones abiertas. Para
        confirmar, ingresá tu contraseña y un código.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="disablePassword" className="text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            id="disablePassword"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="disableCode" className="text-sm font-medium text-gray-700">
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
            className="rounded border border-gray-300 px-3 py-2 tracking-widest text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        {error && <ErrorMessage message={error} />}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Desactivando..." : "Desactivar verificación en dos pasos"}
          </button>
          <button
            type="button"
            onClick={toggleMode}
            className="text-sm font-medium text-gray-900 underline"
          >
            {isRecovery ? "Usar el código de mi app" : "Usar un código de recuperación"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default DisableTwoFactorForm;
