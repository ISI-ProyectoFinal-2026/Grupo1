import { Counter, Trend } from 'k6/metrics'

// tiempo hasta que el reporte sale de pending (SLO-2)
export const matchingDuration = new Trend('matching_duration', true)

// Apdex: satisfechos <= T, tolerables <= 4T
export const apdexSatisfied = new Counter('apdex_satisfied')
export const apdexTolerating = new Counter('apdex_tolerating')
export const apdexTotal = new Counter('apdex_total')
