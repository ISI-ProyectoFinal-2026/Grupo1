import ActionErrorMessage from "@/components/auth/ActionErrorMessage";
import ResendVerificationButton from "@/components/auth/ResendVerificationButton";
import { buttonClasses } from "@/components/ui/buttonClasses";

interface TwoFactorDisabledPanelProps {
  /** El backend exige email verificado: sin él se explica y se ofrece reenviar, no un botón muerto. */
  emailUnverified: boolean;
  isStarting: boolean;
  error: { message: string; code?: string } | null;
  onStart: () => void;
}

function TwoFactorDisabledPanel({
  emailUnverified,
  isStarting,
  error,
  onStart,
}: TwoFactorDisabledPanelProps) {
  return (
    <section
      aria-labelledby="two-factor-disabled-title"
      className="card mt-6 p-4 sm:p-5"
    >
      <h2 id="two-factor-disabled-title" className="font-display text-display-sm text-ink">
        Verificación en dos pasos
      </h2>
      <p className="mt-1 text-ink-muted">
        Está desactivada. Si la activás, además de tu contraseña vas a ingresar un código de 6
        dígitos de una app de autenticación (Google Authenticator, Aegis, 1Password u otra) cada
        vez que inicies sesión.
      </p>

      {emailUnverified ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-card border border-signal bg-signal/15 p-4 text-sm text-ink">
          <p>
            Para activar la verificación en dos pasos primero tenés que verificar tu email. Revisá
            tu casilla o pedí otro email.
          </p>
          <ResendVerificationButton />
        </div>
      ) : (
        <>
          {error && (
            <ActionErrorMessage message={error.message} code={error.code} className="mt-4" />
          )}
          <button
            type="button"
            onClick={onStart}
            disabled={isStarting}
            className={buttonClasses("primary", "md", "mt-4 w-full sm:w-auto")}
          >
            {isStarting ? "Preparando..." : "Activar verificación en dos pasos"}
          </button>
        </>
      )}
    </section>
  );
}

export default TwoFactorDisabledPanel;
