import { sleep } from 'k6'

// espera aleatoria entre pasos; THINK_MIN / THINK_MAX (segundos) la sobrescriben
export function think(defaultMin = 3, defaultMax = 8) {
  const min = Number(__ENV.THINK_MIN ?? defaultMin)
  const max = Number(__ENV.THINK_MAX ?? defaultMax)
  sleep(min + Math.random() * Math.max(0, max - min))
}
