import { useState } from "react";
import type { FormEvent } from "react";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { normalizeSecondFactorCode } from "@/utils/two-factor";

interface RegenerateCodesFormProps {
  isLoading: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
}

function RegenerateCodesForm({ isLoading, error, onSubmit }: RegenerateCodesFormProps) {
  const [code, setCode] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(normalizeSecondFactorCode("totp", code));
  }

  return (
    <section
      aria-labelledby="regenerate-codes-title"
      className="card mt-4 p-4 sm:p-5"
    >
      <h3 id="regenerate-codes-title" className="font-display text-display-sm text-ink">
        Generar códigos de recuperación nuevos
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        Los códigos anteriores dejan de funcionar y se cierran tus otras sesiones abiertas.
        Necesitás el código actual de tu app: acá no sirve un código de recuperación.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="regenerateCode" className="field-label">
            Código de tu app
          </label>
          <input
            id="regenerateCode"
            type="text"
            required
            spellCheck={false}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="field tabular font-bold tracking-widest"
          />
        </div>

        {error && <ErrorMessage message={error} />}

        <button
          type="submit"
          disabled={isLoading}
          className={buttonClasses("secondary", "md", "self-start")}
        >
          {isLoading ? "Generando..." : "Generar códigos nuevos"}
        </button>
      </form>
    </section>
  );
}

export default RegenerateCodesForm;
