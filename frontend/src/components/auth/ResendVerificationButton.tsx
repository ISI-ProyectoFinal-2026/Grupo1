import { useResendVerification, ALREADY_VERIFIED_STATUS } from "@/hooks/useResendVerification";
import { getApiErrorStatus } from "@/services/api";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { CheckIcon } from "@/components/ui/icons";

const SENT_MESSAGE = "Te mandamos un nuevo email";
const ALREADY_VERIFIED_MESSAGE = "Tu email ya está verificado";

function ResendVerificationButton() {
  const { mutate, isPending, isSuccess, isError, error } = useResendVerification();

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => mutate()}
        disabled={isPending}
        className={buttonClasses("primary", "sm")}
      >
        {isPending ? "Enviando..." : "Reenviar email de verificación"}
      </button>

      {isSuccess && (
        <p role="status" className="flex items-center gap-1.5 text-sm font-bold text-success-ink">
          <CheckIcon className="h-4 w-4 shrink-0" />
          {SENT_MESSAGE}
        </p>
      )}
      {isError &&
        (getApiErrorStatus(error) === ALREADY_VERIFIED_STATUS ? (
          <p role="status" className="flex items-center gap-1.5 text-sm font-bold text-success-ink">
            <CheckIcon className="h-4 w-4 shrink-0" />
            {ALREADY_VERIFIED_MESSAGE}
          </p>
        ) : (
          <ErrorMessage message={error.message} />
        ))}
    </div>
  );
}

export default ResendVerificationButton;
