import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { CheckIcon } from "@/components/ui/icons";

interface RecoveryCodesModalProps {
  codes: string[];
  onClose: () => void;
}

const FILE_NAME = "patitas-codigos-de-recuperacion.txt";
const FOCUSABLE = "button:not(:disabled), input:not(:disabled)";
const SECONDARY_BUTTON_CLASS = buttonClasses("secondary", "sm");

type CopyState = "idle" | "copied" | "failed";

/**
 * Muestra los códigos de recuperación una sola vez. No se cierra con Escape ni
 * con un click en el fondo: solo con el botón, y recién después de que la
 * persona confirma que los guardó. Se usa igual al activar y al regenerar.
 */
function RecoveryCodesModal({ codes, onClose }: RecoveryCodesModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const text = codes.join("\n");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  function handleDownload() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
  }

  // El foco se queda adentro: con el modal abierto no hay nada más con lo que
  // interactuar, y salir con Tab dejaría operar la página de atrás.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div
      data-testid="recovery-codes-overlay"
      className="fixed inset-0 z-50 flex animate-fade items-end justify-center bg-ink/40 p-4 pb-[calc(1rem+var(--safe-bottom))] sm:items-center"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="max-h-full w-full max-w-md animate-sheet overflow-y-auto overscroll-contain rounded-card bg-paper p-5 shadow-pop focus:outline-none sm:animate-pop sm:p-6"
      >
        <h2 id={titleId} className="font-display text-display-md">
          Tus códigos de recuperación
        </h2>
        <p className="mt-2 text-ink-muted">
          Si perdés tu autenticador, cada código te deja iniciar sesión una vez. Guardalos en un
          lugar seguro: no vas a poder volver a verlos.
        </p>

        <ul className="mt-4 grid grid-cols-2 gap-2 rounded-control border border-line bg-surface p-3 font-mono text-sm tracking-wider text-ink">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleCopy} className={SECONDARY_BUTTON_CLASS}>
            Copiar códigos
          </button>
          <button type="button" onClick={handleDownload} className={SECONDARY_BUTTON_CLASS}>
            Descargar códigos
          </button>
          {copyState === "copied" && (
            <span role="status" className="inline-flex items-center gap-1 text-sm font-bold text-success-ink">
              <CheckIcon className="h-5 w-5 shrink-0 accent-ink" />
              Códigos copiados
            </span>
          )}
          {copyState === "failed" && (
            <span role="status" className="text-sm font-bold text-danger">
              No pudimos copiar: seleccionalos y copialos a mano
            </span>
          )}
        </div>

        <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-3 font-bold text-ink">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
            className="h-5 w-5 shrink-0 accent-ink"
          />
          Guardé mis códigos
        </label>

        <button
          type="button"
          onClick={onClose}
          disabled={!saved}
          className={buttonClasses("primary", "lg", "mt-3 w-full")}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default RecoveryCodesModal;
