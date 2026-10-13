import { useResendVerification, ALREADY_VERIFIED_STATUS } from "@/hooks/useResendVerification";
import { getApiErrorStatus } from "@/services/api";
import ErrorMessage from "@/components/ui/ErrorMessage";

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
        className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Enviando..." : "Reenviar email de verificación"}
      </button>

      {isSuccess && (
        <p role="status" className="text-sm text-green-700">
          {SENT_MESSAGE}
        </p>
      )}
      {isError &&
        (getApiErrorStatus(error) === ALREADY_VERIFIED_STATUS ? (
          <p role="status" className="text-sm text-green-700">
            {ALREADY_VERIFIED_MESSAGE}
          </p>
        ) : (
          <ErrorMessage message={error.message} />
        ))}
    </div>
  );
}

export default ResendVerificationButton;
