import type { FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { buttonClasses } from "@/components/ui/buttonClasses";
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
      className="card mt-6 p-4 sm:p-5"
    >
      <h2 id="two-factor-setup-title" className="font-display text-display-sm text-ink">
        Activar la verificación en dos pasos
      </h2>
      <p className="mt-1 text-ink-muted">
        Escaneá el código QR con tu app de autenticación y después ingresá el código de 6 dígitos
        que te muestra para confirmar.
      </p>

      <div className="mt-4 flex justify-center rounded-control border border-line bg-paper p-3">
        <QRCodeSVG value={setup.otpauthUri} size={176} marginSize={2} title={QR_TITLE} />
      </div>

      <p className="mt-4 text-sm text-ink-muted">Si no podés escanearlo, ingresá esta clave a mano:</p>
      <p className="mt-1 select-all break-all rounded-control border border-line bg-surface px-3 py-2.5 font-mono text-sm tracking-wider text-ink">
        {setup.secret}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="setupCode" className="field-label">
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
            className="field tabular font-bold tracking-widest"
          />
        </div>

        {error && <ErrorMessage message={error} />}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className={buttonClasses("primary")}
          >
            {isLoading ? "Activando..." : "Confirmar y activar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className={buttonClasses("ghost")}
          >
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

export default TwoFactorSetupPanel;
