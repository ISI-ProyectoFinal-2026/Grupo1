import EmailNotVerifiedNotice from "@/components/auth/EmailNotVerifiedNotice";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { EMAIL_NOT_VERIFIED } from "@/types/auth";

interface ActionErrorMessageProps {
  message: string;
  /** Código de máquina del backend (`error.code`); decide qué se muestra. */
  code?: string | null;
  className?: string;
}

/** Error de una acción protegida: el 403 de email sin verificar tiene su propio aviso. */
function ActionErrorMessage({ message, code, className = "" }: ActionErrorMessageProps) {
  if (code === EMAIL_NOT_VERIFIED) {
    return <EmailNotVerifiedNotice className={className} />;
  }
  return <ErrorMessage message={message} className={className} />;
}

export default ActionErrorMessage;
