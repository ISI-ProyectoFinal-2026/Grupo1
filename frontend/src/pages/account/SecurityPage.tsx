import { useState } from "react";
import DisableTwoFactorForm from "@/components/account/DisableTwoFactorForm";
import RecoveryCodesModal from "@/components/account/RecoveryCodesModal";
import RegenerateCodesForm from "@/components/account/RegenerateCodesForm";
import TwoFactorDisabledPanel from "@/components/account/TwoFactorDisabledPanel";
import TwoFactorEnabledPanel from "@/components/account/TwoFactorEnabledPanel";
import TwoFactorSetupPanel from "@/components/account/TwoFactorSetupPanel";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Spinner from "@/components/ui/Spinner";
import { useDisableTwoFactor } from "@/hooks/useDisableTwoFactor";
import { useEnableTwoFactor } from "@/hooks/useEnableTwoFactor";
import { useRegenerateRecoveryCodes } from "@/hooks/useRegenerateRecoveryCodes";
import { useSetupTwoFactor } from "@/hooks/useSetupTwoFactor";
import { useTwoFactorStatus } from "@/hooks/useTwoFactorStatus";
import { getApiErrorCode, getApiErrorStatus } from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import type { TwoFactorSetup } from "@/types/auth";
import { isEmailUnverified } from "@/utils/email-verification";
import { getSecondFactorErrorMessage, normalizeSecondFactorCode } from "@/utils/two-factor";

const STATE_CONFLICT_STATUS = 409;

// El secreto del setup y los códigos de recuperación viven solo en el state de
// esta página, hasta que se confirman o se cancelan: no van al store persistido
// ni a la cache de TanStack (las mutaciones se reinician apenas devuelven).
function SecurityPage() {
  const user = useAuthStore((state) => state.user);
  const status = useTwoFactorStatus();
  const setupMutation = useSetupTwoFactor();
  const enableMutation = useEnableTwoFactor();
  const regenerateMutation = useRegenerateRecoveryCodes();
  const disableMutation = useDisableTwoFactor();

  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [regenerateFormKey, setRegenerateFormKey] = useState(0);

  const [startError, setStartError] = useState<{ message: string; code?: string } | null>(null);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);

  async function handleStart() {
    setStartError(null);
    try {
      const result = await setupMutation.mutateAsync();
      setupMutation.reset();
      setSetupCode("");
      setEnableError(null);
      setSetup(result);
    } catch (err) {
      if (getApiErrorStatus(err) === STATE_CONFLICT_STATUS) {
        void status.refetch();
      }
      setStartError({
        message: err instanceof Error ? err.message : getSecondFactorErrorMessage(err),
        code: getApiErrorCode(err),
      });
    }
  }

  function handleCancelSetup() {
    setSetup(null);
    setSetupCode("");
    setEnableError(null);
  }

  async function handleEnable() {
    setEnableError(null);
    try {
      const result = await enableMutation.mutateAsync({
        code: normalizeSecondFactorCode("totp", setupCode),
      });
      enableMutation.reset();
      setSetup(null);
      setSetupCode("");
      setRecoveryCodes(result.recoveryCodes);
    } catch (err) {
      setEnableError(getSecondFactorErrorMessage(err));
    }
  }

  async function handleRegenerate(code: string) {
    setRegenerateError(null);
    try {
      const result = await regenerateMutation.mutateAsync({ code });
      regenerateMutation.reset();
      setRegenerateFormKey((key) => key + 1);
      setRecoveryCodes(result.recoveryCodes);
    } catch (err) {
      setRegenerateError(getSecondFactorErrorMessage(err));
    }
  }

  async function handleDisable(input: { password: string; code: string }) {
    setDisableError(null);
    try {
      await disableMutation.mutateAsync(input);
      disableMutation.reset();
      setRegenerateError(null);
    } catch (err) {
      setDisableError(getSecondFactorErrorMessage(err));
    }
  }

  function renderContent() {
    if (!status.data) {
      if (status.isError) {
        return (
          <div className="mt-6 flex flex-col items-start gap-3">
            <ErrorMessage message={status.error.message} />
            <button
              type="button"
              onClick={() => status.refetch()}
              className="rounded bg-gray-900 px-4 py-2 text-white"
            >
              Reintentar
            </button>
          </div>
        );
      }
      return (
        <div className="mt-6">
          <Spinner />
        </div>
      );
    }

    if (status.data.enabled) {
      return (
        <>
          <TwoFactorEnabledPanel
            recoveryCodesRemaining={status.data.recoveryCodesRemaining}
            resetEffectiveAt={status.data.resetEffectiveAt}
          />
          <RegenerateCodesForm
            key={regenerateFormKey}
            isLoading={regenerateMutation.isPending}
            error={regenerateError}
            onSubmit={handleRegenerate}
          />
          <DisableTwoFactorForm
            isLoading={disableMutation.isPending}
            error={disableError}
            onSubmit={handleDisable}
          />
        </>
      );
    }

    if (setup) {
      return (
        <TwoFactorSetupPanel
          setup={setup}
          code={setupCode}
          isLoading={enableMutation.isPending}
          error={enableError}
          onCodeChange={setSetupCode}
          onSubmit={handleEnable}
          onCancel={handleCancelSetup}
        />
      );
    }

    return (
      <TwoFactorDisabledPanel
        emailUnverified={isEmailUnverified(user)}
        isStarting={setupMutation.isPending}
        error={startError}
        onStart={handleStart}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900">Seguridad de la cuenta</h1>
        {renderContent()}
      </div>

      {recoveryCodes && (
        <RecoveryCodesModal codes={recoveryCodes} onClose={() => setRecoveryCodes(null)} />
      )}
    </div>
  );
}

export default SecurityPage;
