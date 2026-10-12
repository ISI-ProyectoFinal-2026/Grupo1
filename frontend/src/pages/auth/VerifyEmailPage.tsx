import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import ResendVerificationButton from "@/components/auth/ResendVerificationButton";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Spinner from "@/components/ui/Spinner";
import { CURRENT_USER_QUERY_KEY } from "@/hooks/useCurrentUser";
import { useUrlToken } from "@/hooks/useUrlToken";
import { useVerifyEmail } from "@/hooks/useVerifyEmail";
import { getMe } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { isEmailUnverified } from "@/utils/email-verification";

type Phase = "verifying" | "verified" | "invalid";

const INVALID_LINK_MESSAGE = "El enlace es inválido o expiró";

function VerifyEmailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useUrlToken();
  const { mutateAsync: verify } = useVerifyEmail();

  const sessionToken = useAuthStore((state) => state.token);
  const sessionUser = useAuthStore((state) => state.user);

  const [phase, setPhase] = useState<Phase>(token ? "verifying" : "invalid");
  const [errorMessage, setErrorMessage] = useState(INVALID_LINK_MESSAGE);
  // StrictMode monta dos veces en desarrollo: el token es de un solo uso, así
  // que el segundo POST fallaría con 400 y taparía el éxito del primero.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token || startedRef.current) return;
    startedRef.current = true;

    // El link se abre con o sin sesión y puede ser de otra cuenta. Solo se
    // toca la sesión si /me confirma que la cuenta logueada quedó verificada.
    async function handleVerified() {
      const { token: currentToken, user } = useAuthStore.getState();
      if (!currentToken || !user) {
        navigate("/login", { replace: true, state: { emailVerified: true } });
        return;
      }
      if (isEmailUnverified(user)) {
        try {
          const me = await getMe();
          queryClient.setQueryData(CURRENT_USER_QUERY_KEY, me);
          if (me.emailVerifiedAt !== null) {
            useAuthStore.getState().setUser(me);
            navigate("/", { replace: true });
            return;
          }
        } catch {
          // Sin /me no se puede confirmar nada sobre la sesión: se muestra el
          // éxito del link y el banner corrige el estado en la próxima carga.
        }
      }
      setPhase("verified");
    }

    async function run(linkToken: string) {
      try {
        await verify(linkToken);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : INVALID_LINK_MESSAGE);
        setPhase("invalid");
        return;
      }
      await handleVerified();
    }

    void run(token);
  }, [token, verify, navigate, queryClient]);

  if (phase === "verifying") {
    return (
      <div className="p-6">
        <div className="mx-auto flex max-w-sm items-center gap-3 text-gray-700">
          <Spinner size="sm" />
          <p>Verificando tu email...</p>
        </div>
      </div>
    );
  }

  if (phase === "verified") {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900">Email verificado</h1>
          <p className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            Tu email quedó verificado.
          </p>
          <p className="mt-4 text-sm">
            <Link to="/" className="font-medium text-gray-900 underline">
              Ir al inicio
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Enlace no válido</h1>
        <ErrorMessage message={errorMessage} className="mt-4" />

        <div className="mt-4 text-sm text-gray-600">
          {!sessionToken ? (
            <p>
              <Link to="/login" className="font-medium text-gray-900 underline">
                Iniciá sesión
              </Link>{" "}
              para pedir un nuevo email de verificación.
            </p>
          ) : isEmailUnverified(sessionUser) ? (
            <ResendVerificationButton />
          ) : (
            <Link to="/" className="font-medium text-gray-900 underline">
              Ir al inicio
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
