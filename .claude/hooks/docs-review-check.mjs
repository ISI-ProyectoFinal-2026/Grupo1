// hook SessionStart: avisa al agente cuando vence la revisión periódica de docs
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_INTERVAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  let state = {};
  try {
    state = JSON.parse(readFileSync(join(root, "docs", ".docs-review.json"), "utf8"));
  } catch {
    // sin archivo de estado: la revisión se considera vencida
  }

  const interval = Number(state.intervalDays) || DEFAULT_INTERVAL_DAYS;
  const last = state.lastReview ? new Date(`${state.lastReview}T00:00:00`) : null;
  const elapsed = last && !Number.isNaN(last.getTime())
    ? Math.floor((Date.now() - last.getTime()) / DAY_MS)
    : null;

  if (elapsed !== null && elapsed < interval) process.exit(0);

  const since = elapsed === null
    ? "no hay registro de una revisión anterior"
    : `la última fue el ${state.lastReview} (hace ${elapsed} días; intervalo: ${interval})`;

  process.stdout.write(JSON.stringify({
    systemMessage: `Revisión de documentación técnica vencida: ${since}.`,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext:
        `REVISIÓN PERIÓDICA DE DOCUMENTACIÓN VENCIDA: ${since}. ` +
        "En tu primera respuesta de esta sesión, informale al usuario y ejecutá el skill `docs-review` " +
        "antes de continuar con otra tarea, salvo que el usuario pida posponerla.",
    },
  }));
} catch {
  // el hook nunca debe bloquear el inicio de sesión
}
process.exit(0);
