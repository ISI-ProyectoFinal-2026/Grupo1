import ResendVerificationButton from "@/components/auth/ResendVerificationButton";

interface EmailNotVerifiedNoticeProps {
  className?: string;
}

/**
 * Se muestra en lugar del error crudo cuando el backend responde 403
 * EMAIL_NOT_VERIFIED. El botón de la acción queda habilitado a propósito: lo
 * que ya cargó el usuario se conserva y reintenta apenas verifica.
 */
function EmailNotVerifiedNotice({ className = "" }: EmailNotVerifiedNoticeProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 ${className}`}
    >
      <p>Verificá tu email para poder hacer esto. Revisá tu casilla o pedí otro email.</p>
      <ResendVerificationButton />
    </div>
  );
}

export default EmailNotVerifiedNotice;
