// umbral de denuncias distintas que oculta un reporte (#218)
const DEFAULT_REPORT_FLAG_THRESHOLD = 5;

export function getReportFlagThreshold(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.REPORT_FLAG_THRESHOLD?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_REPORT_FLAG_THRESHOLD;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_REPORT_FLAG_THRESHOLD;
}
