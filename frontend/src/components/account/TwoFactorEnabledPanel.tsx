import { formatResetDate } from "@/utils/two-factor";

interface TwoFactorEnabledPanelProps {
  recoveryCodesRemaining: number;
  /** ISO de un reinicio pendiente, o null. */
  resetEffectiveAt: string | null;
}

// Con tres o menos códigos conviene regenerarlos antes de quedarse sin ninguno.
const LOW_CODES_THRESHOLD = 3;

function remainingText(count: number): string {
  return count === 1
    ? "Te queda 1 código de recuperación."
    : `Te quedan ${count} códigos de recuperación.`;
}

function TwoFactorEnabledPanel({
  recoveryCodesRemaining,
  resetEffectiveAt,
}: TwoFactorEnabledPanelProps) {
  return (
    <section
      aria-labelledby="two-factor-enabled-title"
      className="mt-6 rounded border border-gray-200 p-4"
    >
      <h2 id="two-factor-enabled-title" className="text-lg font-semibold text-gray-900">
        Verificación en dos pasos
      </h2>
      <p className="mt-2 text-sm text-gray-600">La verificación en dos pasos está activada.</p>

      {resetEffectiveAt && (
        <p
          role="status"
          className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          Hay un reinicio de la verificación en dos pasos en curso: se completa el{" "}
          {formatResetDate(resetEffectiveAt)}. Si no lo pediste, cancelalo desde el enlace del email
          que te mandamos o volvé a iniciar sesión con un código válido.
        </p>
      )}

      <p className="mt-4 text-sm font-medium text-gray-900">
        {remainingText(recoveryCodesRemaining)}
      </p>
      {recoveryCodesRemaining <= LOW_CODES_THRESHOLD && (
        <p
          role="status"
          className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          Quedan pocos códigos de recuperación: generá códigos nuevos antes de quedarte sin
          ninguno.
        </p>
      )}
    </section>
  );
}

export default TwoFactorEnabledPanel;
