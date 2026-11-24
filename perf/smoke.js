import { SUMMARY_TREND_STATS } from './lib/config.js'
import { browseFeed, createReport, loginAndMe, myReportsAndMatches } from './lib/flows.js'
import { endpointSubmetrics, buildSummary } from './lib/summary.js'

// think time corto para el smoke (sobrescribible con THINK_MIN / THINK_MAX)
const THINK = [0.2, 0.5]

export const options = {
  scenarios: {
    smoke: { executor: 'constant-vus', vus: 2, duration: '1m' },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  thresholds: {
    checks: ['rate==1'],
    http_req_failed: ['rate==0'],
    ...endpointSubmetrics(),
  },
}

// recorre todos los flujos (sin flyer ni chat)
export default function () {
  browseFeed(THINK)
  myReportsAndMatches(THINK)
  createReport(THINK, { pollAttempts: 3, pollIntervalS: 1 })
  loginAndMe(THINK)
}

export function handleSummary(data) {
  return buildSummary('smoke', data)
}
