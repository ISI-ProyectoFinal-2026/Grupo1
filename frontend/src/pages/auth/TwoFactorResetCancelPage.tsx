import { useEffect, useRef, useState } from "react";
import LinkFlowExit from "@/components/auth/LinkFlowExit";
import ErrorMessage from "@/components/ui/ErrorMessage";
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
      <div className="p-6">
        <div className="mx-auto flex max-w-sm items-center gap-3 text-gray-700">
          <Spinner size="sm" />
          <p>Cancelando el reinicio...</p>
        </div>
      </div>
    );
  }

  if (phase === "cancelled") {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900">Reinicio cancelado</h1>
          <p
            role="status"
            className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
          >
            La verificación en dos pasos de tu cuenta sigue activa.
          </p>
          <LinkFlowExit />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Enlace no válido</h1>
        <ErrorMessage message={errorMessage} className="mt-4" />
        <LinkFlowExit />
      </div>
    </div>
  );
}

export default TwoFactorResetCancelPage;
