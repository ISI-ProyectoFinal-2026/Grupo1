import { useState } from "react";
import LinkFlowExit from "@/components/auth/LinkFlowExit";
import AuthCard from "@/components/ui/AuthCard";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { useConfirmTwoFactorReset } from "@/hooks/useConfirmTwoFactorReset";
import { useUrlToken } from "@/hooks/useUrlToken";
import { getApiErrorStatus } from "@/services/api";
import { formatResetDate } from "@/utils/two-factor";

const INVALID_LINK_MESSAGE = "El enlace es inválido o expiró";
const LINK_REJECTED_STATUS = 400;

type Phase = { kind: "ready" } | { kind: "confirmed"; resetEffectiveAt: string } | { kind: "invalid" };

// Pública a propósito: el link del email se abre con o sin sesión, y esta
// página nunca lee ni escribe la sesión.
function TwoFactorResetConfirmPage() {
  const token = useUrlToken();
  const { mutateAsync: confirm, isPending } = useConfirmTwoFactorReset();

  const [phase, setPhase] = useState<Phase>(token ? { kind: "ready" } : { kind: "invalid" });
  const [error, setError] = useState<string | null>(null);

  // Solo se confirma con un click: un scanner de mails que ejecuta JS abre el
  // link, y confirmar al cargar le dejaría arrancar el reinicio de otra persona.
  async function handleConfirm() {
    if (!token) return;
    setError(null);

    try {
      const { resetEffectiveAt } = await confirm(token);
      setPhase({ kind: "confirmed", resetEffectiveAt });
    } catch (err) {
      if (getApiErrorStatus(err) === LINK_REJECTED_STATUS) {
        setPhase({ kind: "invalid" });
        return;
      }
      setError(err instanceof Error ? err.message : "Error inesperado, intentá de nuevo");
    }
  }

  if (phase.kind === "invalid") {
    return (
      <AuthCard title="Enlace no válido">
        <ErrorMessage message={INVALID_LINK_MESSAGE} className="mt-4" />
        <LinkFlowExit />
      </AuthCard>
    );
  }

  if (phase.kind === "confirmed") {
    return (
      <AuthCard title="Reinicio en curso">
        <p role="status" className="mt-5 rounded-card border border-signal bg-signal/15 p-4 text-sm font-bold text-ink">
          El reinicio de la verificación en dos pasos se completa el{" "}
          {formatResetDate(phase.resetEffectiveAt)}.
        </p>
        <p className="mt-4 text-sm text-ink-muted">
          Si no fuiste vos, podés cancelarlo desde el email que te enviamos o iniciando sesión con
          un código válido.
        </p>
        <LinkFlowExit />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Confirmar reinicio de la verificación en dos pasos">
      <p className="mt-2 text-ink-muted">
        Al confirmar empieza una espera de 72 horas. Pasado ese tiempo vas a poder iniciar sesión
        solo con tu contraseña y la verificación en dos pasos queda desactivada. Te mandamos un
        email con un enlace para cancelarlo.
      </p>

      {error && <ErrorMessage message={error} className="mt-4" />}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className={buttonClasses("danger", "lg", "mt-6 w-full")}
      >
        {isPending ? "Confirmando..." : "Confirmar reinicio"}
      </button>

      <LinkFlowExit />
    </AuthCard>
  );
}

export default TwoFactorResetConfirmPage;
