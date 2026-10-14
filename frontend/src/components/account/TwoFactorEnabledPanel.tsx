import { ShieldIcon } from "@/components/ui/icons";
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
      className="card mt-6 p-4 sm:p-5"
    >
      <h2 id="two-factor-enabled-title" className="font-display text-display-sm text-ink">
        Verificación en dos pasos
      </h2>
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-sm font-bold text-success-ink">
        <ShieldIcon className="h-4 w-4 shrink-0" />
        La verificación en dos pasos está activada.
      </p>

      {resetEffectiveAt && (
        <p
          role="status"
          className="mt-4 rounded-card border border-signal bg-signal/15 p-4 text-sm text-ink"
        >
          Hay un reinicio de la verificación en dos pasos en curso: se completa el{" "}
          {formatResetDate(resetEffectiveAt)}. Si no lo pediste, cancelalo desde el enlace del email
          que te mandamos o volvé a iniciar sesión con un código válido.
        </p>
      )}

      <p className="tabular mt-4 font-bold text-ink">
        {remainingText(recoveryCodesRemaining)}
      </p>
      {recoveryCodesRemaining <= LOW_CODES_THRESHOLD && (
        <p
          role="status"
          className="mt-2 rounded-card border border-signal bg-signal/15 p-4 text-sm text-ink"
        >
          Quedan pocos códigos de recuperación: generá códigos nuevos antes de quedarte sin
          ninguno.
        </p>
      )}
    </section>
  );
}

export default TwoFactorEnabledPanel;
