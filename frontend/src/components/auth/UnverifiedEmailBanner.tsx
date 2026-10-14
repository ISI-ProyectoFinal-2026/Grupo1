import ResendVerificationButton from "@/components/auth/ResendVerificationButton";
import { useAuthStore } from "@/stores/auth.store";
import { isEmailUnverified } from "@/utils/email-verification";

/** Banner global para quien tiene sesión pero todavía no verificó su email. */
function UnverifiedEmailBanner() {
  const user = useAuthStore((state) => state.user);

  if (!user || !isEmailUnverified(user)) {
    return null;
  }

  return (
    <section
      aria-label="Verificación de email"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-signal bg-signal/15 px-4 py-3 text-sm text-ink sm:px-6"
    >
      <p className="min-w-0 max-w-prose">
        Verificá tu email: te mandamos un enlace a <strong className="break-all">{user.email}</strong>. Hasta
        entonces no podés publicar reportes, subir imágenes ni chatear.
      </p>
      <ResendVerificationButton />
    </section>
  );
}

export default UnverifiedEmailBanner;
