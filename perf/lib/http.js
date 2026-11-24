import http from 'k6/http'
import { check } from 'k6'
import { APDEX_T_MS, BASE_URL } from './config.js'
import { apdexSatisfied, apdexTolerating, apdexTotal } from './metrics.js'

function params(name, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return { headers, tags: { name } }
}

// Apdex de la API (el login queda afuera: bcrypt domina su latencia)
function recordApdex(name, res) {
  if (name === 'login') return
  apdexTotal.add(1)
  if (res.status >= 500 || res.status === 0) return
  if (res.timings.duration <= APDEX_T_MS) apdexSatisfied.add(1)
  else if (res.timings.duration <= 4 * APDEX_T_MS) apdexTolerating.add(1)
}

export function get(name, path, token) {
  const res = http.get(`${BASE_URL}${path}`, params(name, token))
  recordApdex(name, res)
  return res
}

export function post(name, path, body, token) {
  const res = http.post(`${BASE_URL}${path}`, JSON.stringify(body), params(name, token))
  recordApdex(name, res)
  return res
}

// parsea el cuerpo sin romper el check si no es JSON
export function json(res) {
  try {
    return res.json()
  } catch {
    return null
  }
}

// check con nombre estable por paso: "<paso>: <condición>"
export function checkStep(res, step, expectedStatus, bodyCheck) {
  const body = json(res)
  const checks = { [`${step}: status ${expectedStatus}`]: (r) => r.status === expectedStatus }
  if (bodyCheck) checks[`${step}: body válido`] = () => body !== null && bodyCheck(body)
  return check(res, checks)
}
