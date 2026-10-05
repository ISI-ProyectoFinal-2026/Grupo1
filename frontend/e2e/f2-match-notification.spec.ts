import { expect, loginAs, test } from './fixtures.ts'
import * as api from './support/api.ts'
import { getMatchStatus, seedMatch } from './support/db.ts'

test('F2: the owner is notified of an AI match and confirms it from the report detail', async ({ page, users }) => {
  const owner = await users.create('f2-owner')
  const finder = await users.create('f2-finder')
  const lost = await api.createReport(owner.token, { reportType: 'lost', title: `Gata perdida F2 ${Date.now()}` })
  const found = await api.createReport(finder.token, { reportType: 'found', title: `Gata encontrada F2 ${Date.now()}` })

  // What backend-ia does when it finds a candidate: persist the match, then
  // call the internal notification endpoint.
  const matchId = await seedMatch(lost.id, found.id, 0.87)
  await api.notifyMatch(lost.id, found.id, 0.87)

  await loginAs(page, owner)
  // The bell polls every 30s: a fresh load fetches the notification right away.
  await page.goto('/')
  await expect(page.getByLabel('1 notificaciones sin leer')).toBeVisible()
  await page.getByRole('button', { name: 'Notificaciones' }).click()
  await expect(page.getByText('¡Posible coincidencia encontrada!')).toBeVisible()
  await expect(page.getByText(/87% de similitud/)).toBeVisible()

  await page.goto(`/reports/${lost.id}`)
  await expect(page.getByRole('heading', { name: lost.title })).toBeVisible()
  await expect(page.getByText(found.title)).toBeVisible()
  await expect(page.getByText('87% de coincidencia')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar coincidencia' }).click()

  await expect(page.getByText('Coincidencia confirmada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar coincidencia' })).toHaveCount(0)
  expect(await getMatchStatus(matchId)).toBe('confirmed')

  // Persisted, not just optimistic UI.
  await page.reload()
  await expect(page.getByText('Coincidencia confirmada')).toBeVisible()
})
