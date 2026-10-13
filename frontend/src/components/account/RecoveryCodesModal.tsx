import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

interface RecoveryCodesModalProps {
  codes: string[];
  onClose: () => void;
}

const FILE_NAME = "patitas-codigos-de-recuperacion.txt";
const FOCUSABLE = "button:not(:disabled), input:not(:disabled)";
const SECONDARY_BUTTON_CLASS =
  "rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl focus:outline-none"
      >
        <h2 id={titleId} className="text-xl font-bold text-gray-900">
          Tus códigos de recuperación
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Si perdés tu autenticador, cada código te deja iniciar sesión una vez. Guardalos en un
          lugar seguro: no vas a poder volver a verlos.
        </p>

        <ul className="mt-4 grid grid-cols-2 gap-2 rounded border border-gray-200 bg-gray-50 p-3 font-mono text-sm text-gray-900">
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
            <span role="status" className="text-sm text-green-700">
              Códigos copiados
            </span>
          )}
          {copyState === "failed" && (
            <span role="status" className="text-sm text-red-600">
              No pudimos copiar: seleccionalos y copialos a mano
            </span>
          )}
        </div>

        <label className="mt-5 flex items-center gap-2 text-sm font-medium text-gray-900">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
            className="h-4 w-4"
          />
          Guardé mis códigos
        </label>

        <button
          type="button"
          onClick={onClose}
          disabled={!saved}
          className="mt-4 w-full rounded bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default RecoveryCodesModal;
