// parámetros del matching por similitud (ADR-0014, #217); se leen en cada búsqueda
export interface MatchingConfig {
  matchThreshold: number;
  notifyThreshold: number;
  radiusMeters: number;
  windowDays: number;
  topK: number;
}

const DEFAULTS: MatchingConfig = {
  matchThreshold: 0.45,
  notifyThreshold: 0.63,
  radiusMeters: 5000,
  windowDays: 90,
  topK: 5,
};

// similitud coseno: número finito entre 0 y 1
function readThreshold(raw: string | undefined, fallback: number): number {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const trimmed = raw?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return fallback;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function getMatchingConfig(env: NodeJS.ProcessEnv = process.env): MatchingConfig {
  return {
    matchThreshold: readThreshold(env.MATCH_THRESHOLD, DEFAULTS.matchThreshold),
    notifyThreshold: readThreshold(env.NOTIFY_THRESHOLD, DEFAULTS.notifyThreshold),
    radiusMeters: readPositiveInt(env.MATCH_RADIUS_METERS, DEFAULTS.radiusMeters),
    windowDays: readPositiveInt(env.MATCH_WINDOW_DAYS, DEFAULTS.windowDays),
    topK: readPositiveInt(env.MATCH_TOP_K, DEFAULTS.topK),
  };
}
