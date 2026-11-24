// configuración común (variables de entorno de k6: -e NOMBRE=valor)
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001'
export const R2_PUBLIC_URL = __ENV.R2_PUBLIC_URL || 'https://pub-e2e.r2.dev'

// umbral de Apdex en ms (T), alineado con SLO-1
export const APDEX_T_MS = 500

// endpoints etiquetados con el tag name
export const ENDPOINTS = ['feed', 'detail', 'create', 'matches', 'mine', 'flyer', 'login', 'me']

// percentiles del resumen
export const SUMMARY_TREND_STATS = ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)']

// SLO propuestos en el issue #40
export const SLO = {
  p95Ms: 500,
  p99Ms: 1000,
  matchingP95Ms: 5000,
  errorRate: 0.01,
  apdex: 0.9,
}
