import type { FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import ErrorMessage from "@/components/ui/ErrorMessage";
import type { TwoFactorSetup } from "@/types/auth";

interface TwoFactorSetupPanelProps {
  setup: TwoFactorSetup;
  code: string;
  isLoading: boolean;
  error: string | null;
  onCodeChange: (code: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const QR_TITLE = "Código QR para tu app de autenticación";

function TwoFactorSetupPanel({
  setup,
  code,
  isLoading,
  error,
  onCodeChange,
  onSubmit,
  onCancel,
}: TwoFactorSetupPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section
      aria-labelledby="two-factor-setup-title"
      className="mt-6 rounded border border-gray-200 p-4"
    >
      <h2 id="two-factor-setup-title" className="text-lg font-semibold text-gray-900">
        Activar la verificación en dos pasos
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Escaneá el código QR con tu app de autenticación y después ingresá el código de 6 dígitos
        que te muestra para confirmar.
      </p>

      <div className="mt-4 flex justify-center rounded border border-gray-200 bg-white p-3">
        <QRCodeSVG value={setup.otpauthUri} size={176} marginSize={2} title={QR_TITLE} />
      </div>

      <p className="mt-4 text-sm text-gray-600">Si no podés escanearlo, ingresá esta clave a mano:</p>
      <p className="mt-1 break-all rounded bg-gray-50 px-3 py-2 font-mono text-sm tracking-wider text-gray-900">
        {setup.secret}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="setupCode" className="text-sm font-medium text-gray-700">
            Código de 6 dígitos
          </label>
          <input
            id="setupCode"
            type="text"
            required
            autoFocus
            spellCheck={false}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 tracking-widest text-gray-900 focus:border-gray-500 focus:outline-none"
          />
        </div>

        {error && <ErrorMessage message={error} />}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Activando..." : "Confirmar y activar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-sm font-medium text-gray-900 underline disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

export default TwoFactorSetupPanel;
