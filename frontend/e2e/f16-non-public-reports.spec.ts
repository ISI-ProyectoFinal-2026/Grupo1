import { E2E_PHOTO, expect, loginAs, test } from './fixtures.ts'
import * as api from './support/api.ts'
import { getCustomFlyerUrl, getMatchStatus, insertMatch, setReportStatus } from './support/db.ts'
import { E2E_FLYER_IMAGE_URL, E2E_NO_ANIMAL_IMAGE_URL, FRONTEND_URL } from './support/env.ts'

const NO_ANIMAL_MESSAGE = 'Su publicación no se puede subir debido a que no se detectan animales. Posible SPAM'

// #311: the owner's custom flyer goes through the AI screening
test.describe('F16: custom flyer screening', () => {
  for (const { label, publicUrl, saved } of [
    { label: 'without an animal is rejected and not saved', publicUrl: E2E_NO_ANIMAL_IMAGE_URL, saved: false },
    { label: 'with an animal is saved and shown', publicUrl: E2E_FLYER_IMAGE_URL, saved: true },
  ]) {
    test(`F16: a custom flyer ${label}`, async ({ page, users }) => {
      const owner = await users.create('f16-flyer')
      const report = await api.createPublishedReport(owner.token, { reportType: 'lost', title: `Perro F16 flyer ${Date.now()}` })
      // Registered after the fixture's stub, so it wins: the AI stub judges this URL.
      await page.route('**/api/uploads/presign', (route) =>
        route.fulfill({ json: { uploadUrl: `${FRONTEND_URL}/e2e-r2-upload`, publicUrl, key: 'flyers/e2e-flyer.png' } }),
      )

      await loginAs(page, owner)
      await page.goto(`/reports/${report.id}`)
      await expect(page.getByText('o subí tu propio flyer')).toBeVisible()
      await page.locator('input[type=file]').setInputFiles(E2E_PHOTO)

      if (saved) {
        await expect(page.getByAltText('Flyer del reporte')).toHaveAttribute('src', publicUrl)
        expect(await getCustomFlyerUrl(report.id)).toBe(publicUrl)
      } else {
        await expect(page.getByRole('alert')).toContainText(NO_ANIMAL_MESSAGE)
        await expect(page.getByAltText('Flyer del reporte')).toHaveCount(0)
        expect(await getCustomFlyerUrl(report.id)).toBeNull()
      }
    })
  }
})

// #180/#311: a non-public report is invisible to anyone but its owner
for (const status of ['pending', 'hidden'] as const) {
  test(`F16: a third party opening a ${status} report sees it is not available, with no matches or contact`, async ({ page, users }) => {
    const owner = await users.create(`f16-${status}-owner`)
    const stranger = await users.create(`f16-${status}-stranger`)
    const report = await api.createPublishedReport(owner.token, { reportType: 'lost', title: `Gato F16 ${status} ${Date.now()}` })
    await setReportStatus(report.id, status)

    await loginAs(page, stranger)
    await page.goto(`/reports/${report.id}`)

    // react-query retries the 404 three times (~7 s) before showing it
    await expect(page.getByRole('heading', { name: 'Este reporte ya no está disponible' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: report.title })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Coincidencias sugeridas' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Contactar al autor' })).toHaveCount(0)
  })
}

test('F16: the owner of a hidden report cannot confirm a match and sees why', async ({ page, users }) => {
  const owner = await users.create('f16-confirm-owner')
  const finder = await users.create('f16-confirm-finder')
  const lost = await api.createPublishedReport(owner.token, { reportType: 'lost', title: `Perra F16 oculta ${Date.now()}` })
  const found = await api.createPublishedReport(finder.token, { reportType: 'found', title: `Perra F16 encontrada ${Date.now()}` })
  const matchId = await insertMatch(lost.id, found.id)
  await setReportStatus(lost.id, 'hidden')

  await loginAs(page, owner)
  await page.goto(`/reports/${lost.id}`)
  await page.getByRole('button', { name: 'Confirmar coincidencia' }).click()

  await expect(page.getByRole('alert')).toContainText('Solo se pueden confirmar coincidencias de reportes publicados')
  expect(await getMatchStatus(matchId)).toBe('pending')
})

test('F16: the owner of a pending report is not offered any match to confirm', async ({ page, users }) => {
  const owner = await users.create('f16-pending-owner')
  const finder = await users.create('f16-pending-finder')
  const lost = await api.createPublishedReport(owner.token, { reportType: 'lost', title: `Perra F16 pendiente ${Date.now()}` })
  const found = await api.createPublishedReport(finder.token, { reportType: 'found', title: `Perra F16 hallada ${Date.now()}` })
  await insertMatch(lost.id, found.id)
  await setReportStatus(lost.id, 'pending')

  await loginAs(page, owner)
  await page.goto(`/reports/${lost.id}`)

  await expect(page.getByText('Estado: Pendiente')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Coincidencias sugeridas' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirmar coincidencia' })).toHaveCount(0)
})
