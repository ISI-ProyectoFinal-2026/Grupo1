import { expect, loginAs, test } from './fixtures.ts'
import * as api from './support/api.ts'
import { getMatchId, getMatchStatus } from './support/db.ts'
import { E2E_MATCH_FOUND_IMAGE_URL, E2E_MATCH_LOST_IMAGE_URL } from './support/env.ts'

test('F2: the owner is notified of an AI match and confirms it from the report detail', async ({ page, users }) => {
  const owner = await users.create('f2-owner')
  const finder = await users.create('f2-finder')
  // The backend stores each embedding, runs the matching and notifies (ADR-0029);
  // the stub embeddings are 0.87 cosine apart.
  const lost = await api.createReportPublishedByAi(owner.token, {
    reportType: 'lost',
    title: `Gata perdida F2 ${Date.now()}`,
    imageUrl: E2E_MATCH_LOST_IMAGE_URL,
  })
  const found = await api.createReportPublishedByAi(finder.token, {
    reportType: 'found',
    title: `Gata encontrada F2 ${Date.now()}`,
    imageUrl: E2E_MATCH_FOUND_IMAGE_URL,
  })
  const matchId = await getMatchId(lost.id, found.id)
  expect(matchId).toBeDefined()

  await loginAs(page, owner)
  // The bell polls every 30s: a fresh load fetches the notification right away.
  // Two unread: the publication notice (report_status_change) and the match.
  await page.goto('/')
  await expect(page.getByLabel('2 notificaciones sin leer')).toBeVisible()
  await page.getByRole('button', { name: 'Notificaciones' }).click()
  await expect(page.getByText('¡Posible coincidencia encontrada!')).toBeVisible()
  await expect(page.getByText(/87% de similitud/)).toBeVisible()

  // The notification links to the candidate report and is marked as read (#222).
  await page.getByRole('link', { name: /Posible coincidencia encontrada/ }).click()
  await expect(page).toHaveURL(new RegExp(`/reports/${found.id}$`))
  await expect(page.getByRole('heading', { name: found.title })).toBeVisible()
  await expect(page.getByLabel('1 notificaciones sin leer')).toBeVisible()

  await page.goto(`/reports/${lost.id}`)
  await expect(page.getByRole('heading', { name: lost.title })).toBeVisible()
  await expect(page.getByText(found.title)).toBeVisible()
  await expect(page.getByText('87% de coincidencia')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar coincidencia' }).click()

  await expect(page.getByText('Coincidencia confirmada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar coincidencia' })).toHaveCount(0)
  expect(await getMatchStatus(matchId!)).toBe('confirmed')

  // Persisted, not just optimistic UI.
  await page.reload()
  await expect(page.getByText('Coincidencia confirmada')).toBeVisible()
})
