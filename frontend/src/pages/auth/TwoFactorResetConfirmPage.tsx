import { useState } from "react";
import LinkFlowExit from "@/components/auth/LinkFlowExit";
import ErrorMessage from "@/components/ui/ErrorMessage";
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
      <div className="p-6">
        <div className="mx-auto max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900">Enlace no válido</h1>
          <ErrorMessage message={INVALID_LINK_MESSAGE} className="mt-4" />
          <LinkFlowExit />
        </div>
      </div>
    );
  }

  if (phase.kind === "confirmed") {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900">Reinicio en curso</h1>
          <p
            role="status"
            className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
          >
            El reinicio de la verificación en dos pasos se completa el{" "}
            {formatResetDate(phase.resetEffectiveAt)}.
          </p>
          <p className="mt-4 text-sm text-gray-600">
            Si no fuiste vos, podés cancelarlo desde el email que te enviamos o iniciando sesión con
            un código válido.
          </p>
          <LinkFlowExit />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Confirmar reinicio de la verificación en dos pasos
        </h1>
        <p className="mt-4 text-sm text-gray-600">
          Al confirmar empieza una espera de 72 horas. Pasado ese tiempo vas a poder iniciar sesión
          solo con tu contraseña y la verificación en dos pasos queda desactivada. Te mandamos un
          email con un enlace para cancelarlo.
        </p>

        {error && <ErrorMessage message={error} className="mt-4" />}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          className="mt-4 rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Confirmando..." : "Confirmar reinicio"}
        </button>

        <LinkFlowExit />
      </div>
    </div>
  );
}

export default TwoFactorResetConfirmPage;
