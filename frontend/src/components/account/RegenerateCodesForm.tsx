import { useState } from "react";
import type { FormEvent } from "react";
import ErrorMessage from "@/components/ui/ErrorMessage";
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
      className="mt-6 rounded border border-gray-200 p-4"
    >
      <h3 id="regenerate-codes-title" className="text-base font-semibold text-gray-900">
        Generar códigos de recuperación nuevos
      </h3>
      <p className="mt-2 text-sm text-gray-600">
        Los códigos anteriores dejan de funcionar y se cierran tus otras sesiones abiertas.
        Necesitás el código actual de tu app: acá no sirve un código de recuperación.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="regenerateCode" className="text-sm font-medium text-gray-700">
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
            className="rounded border border-gray-300 px-3 py-2 tracking-widest text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        {error && <ErrorMessage message={error} />}

        <button
          type="submit"
          disabled={isLoading}
          className="self-start rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Generando..." : "Generar códigos nuevos"}
        </button>
      </form>
    </section>
  );
}

export default RegenerateCodesForm;
