import { SharedArray } from 'k6/data'

// usuarios y reportes generados por perf/seed/seed.mjs
const users = new SharedArray('users', () => JSON.parse(open('../data/users.json')))
const reportIds = new SharedArray('reportIds', () => JSON.parse(open('../data/report-ids.json')))

// un usuario distinto por VU
export function userForVu() {
  return users[(__VU - 1) % users.length]
}

export function randomReportId() {
  return reportIds[Math.floor(Math.random() * reportIds.length)]
}
