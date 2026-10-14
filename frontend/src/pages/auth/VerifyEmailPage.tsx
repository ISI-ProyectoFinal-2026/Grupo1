import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import ResendVerificationButton from "@/components/auth/ResendVerificationButton";
import AuthCard from "@/components/ui/AuthCard";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { CheckIcon } from "@/components/ui/icons";
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
      <div className="flex justify-center px-4 pb-12 pt-4 sm:pt-12">
        <div className="card flex w-full max-w-sm items-center gap-3 p-5 sm:p-7 text-ink-muted">
          <Spinner size="sm" />
          <p>Verificando tu email...</p>
        </div>
      </div>
    );
  }

  if (phase === "verified") {
    return (
      <AuthCard title="Email verificado">
        <p className="mt-5 flex items-start gap-2 rounded-control bg-success-soft px-3 py-2.5 text-sm font-bold text-success-ink">
          <CheckIcon className="h-5 w-5 shrink-0" />
          <span>Tu email quedó verificado.</span>
        </p>
        <p className="mt-6">
          <Link to="/" className={buttonClasses("primary", "lg", "w-full")}>
            Ir al inicio
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Enlace no válido">
      <ErrorMessage message={errorMessage} className="mt-4" />

      <div className="mt-5 text-ink-muted">
        {!sessionToken ? (
          <p>
            <Link to="/login" className="font-bold text-ink underline underline-offset-4 hover:no-underline">
              Iniciá sesión
            </Link>{" "}
            para pedir un nuevo email de verificación.
          </p>
        ) : isEmailUnverified(sessionUser) ? (
          <ResendVerificationButton />
        ) : (
          <Link to="/" className={buttonClasses("secondary", "md", "w-full")}>
            Ir al inicio
          </Link>
        )}
      </div>
    </AuthCard>
  );
}

export default VerifyEmailPage;
