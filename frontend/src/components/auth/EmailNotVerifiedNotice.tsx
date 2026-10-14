import ResendVerificationButton from "@/components/auth/ResendVerificationButton";
import { cn } from "@/lib/cn";

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
      className={cn(
        "flex flex-col items-start gap-3 rounded-card border border-signal bg-signal/15 p-4 text-sm text-ink",
        className,
      )}
    >
      <p>Verificá tu email para poder hacer esto. Revisá tu casilla o pedí otro email.</p>
      <ResendVerificationButton />
    </div>
  );
}

export default EmailNotVerifiedNotice;
