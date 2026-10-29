import { useEffect, useRef, useState } from "react";
import LinkFlowExit from "@/components/auth/LinkFlowExit";
import AuthCard, { AuthFrame } from "@/components/ui/AuthCard";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { CheckIcon } from "@/components/ui/icons";
import Spinner from "@/components/ui/Spinner";
import { useCancelTwoFactorReset } from "@/hooks/useCancelTwoFactorReset";
import { useUrlToken } from "@/hooks/useUrlToken";
import { getApiErrorStatus } from "@/services/api";

type Phase = "cancelling" | "cancelled" | "failed";

const INVALID_LINK_MESSAGE = "El enlace es inválido o expiró";
const LINK_REJECTED_STATUS = 400;

// Pública a propósito: el link del email se abre con o sin sesión, y esta
// página nunca lee ni escribe la sesión.
function TwoFactorResetCancelPage() {
  const token = useUrlToken();
  const { mutateAsync: cancel } = useCancelTwoFactorReset();

  const [phase, setPhase] = useState<Phase>(token ? "cancelling" : "failed");
  const [errorMessage, setErrorMessage] = useState(INVALID_LINK_MESSAGE);
  // StrictMode monta dos veces en desarrollo: el token es de un solo uso, así
  // que el segundo POST fallaría con 400 y taparía el éxito del primero.
  const startedRef = useRef(false);

  // Cancelar es seguro de disparar solo: protege a la cuenta, no la expone. Por
  // eso, a diferencia de confirmar, no espera un click.
  useEffect(() => {
    if (!token || startedRef.current) return;
    startedRef.current = true;

    async function run(linkToken: string) {
      try {
        await cancel(linkToken);
        setPhase("cancelled");
      } catch (err) {
        setErrorMessage(
          getApiErrorStatus(err) !== LINK_REJECTED_STATUS && err instanceof Error
            ? err.message
            : INVALID_LINK_MESSAGE,
        );
        setPhase("failed");
      }
    }

    void run(token);
  }, [token, cancel]);

  if (phase === "cancelling") {
    return (
      <AuthFrame>
        <div className="flex items-center gap-3 text-ink-muted">
          <Spinner size="sm" />
          <p>Cancelando el reinicio...</p>
        </div>
      </AuthFrame>
    );
  }

  if (phase === "cancelled") {
    return (
      <AuthCard title="Reinicio cancelado">
        <p
          role="status"
          data-happy
          className="mt-5 flex items-start gap-2 rounded-control bg-success-soft px-3 py-2.5 text-sm font-bold text-success-ink"
        >
          <CheckIcon className="h-5 w-5 shrink-0" />
          <span>La verificación en dos pasos de tu cuenta sigue activa.</span>
        </p>
        <LinkFlowExit />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Enlace no válido">
      <ErrorMessage message={errorMessage} className="mt-4" />
      <LinkFlowExit />
    </AuthCard>
  );
}

export default TwoFactorResetCancelPage;
