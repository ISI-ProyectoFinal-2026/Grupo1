import ActionErrorMessage from "@/components/auth/ActionErrorMessage";
import ResendVerificationButton from "@/components/auth/ResendVerificationButton";

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
      className="mt-6 rounded border border-gray-200 p-4"
    >
      <h2 id="two-factor-disabled-title" className="text-lg font-semibold text-gray-900">
        Verificación en dos pasos
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Está desactivada. Si la activás, además de tu contraseña vas a ingresar un código de 6
        dígitos de una app de autenticación (Google Authenticator, Aegis, 1Password u otra) cada
        vez que inicies sesión.
      </p>

      {emailUnverified ? (
        <div className="mt-4 flex flex-col items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
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
            className="mt-4 rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStarting ? "Preparando..." : "Activar verificación en dos pasos"}
          </button>
        </>
      )}
    </section>
  );
}

export default TwoFactorDisabledPanel;
