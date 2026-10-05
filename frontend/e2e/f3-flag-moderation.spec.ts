import { expect, loginAs, stubExternalServices, test } from './fixtures.ts'
import * as api from './support/api.ts'
import { setRole } from './support/db.ts'

test('F3: a user flags a report and a moderator resolves it, hiding the report', async ({ page, browser, users }) => {
  const owner = await users.create('f3-owner')
  const reporter = await users.create('f3-reporter')
  const moderator = await users.create('f3-mod')
  const report = await api.createReport(owner.token, { reportType: 'found', title: `Perro encontrado F3 ${Date.now()}` })
  const reason = `Publicación falsa ${Date.now()}`

  await loginAs(page, reporter)
  await page.goto(`/reports/${report.id}`)
  await page.getByRole('button', { name: 'Denunciar' }).click()
  const form = page.getByRole('form', { name: 'Denunciar reporte' })
  await form.getByLabel('Motivo de la denuncia').fill(reason)
  await form.getByRole('button', { name: 'Enviar denuncia' }).click()
  // The loading spinner also has role="status", so match by text.
  await expect(
    page.getByRole('status').filter({ hasText: 'Recibimos tu denuncia. Gracias por avisar.' })
  ).toBeVisible()

  // The role travels in the login response, so promote BEFORE logging in.
  await setRole(moderator.user.id, 'moderador')
  const moderatorSession = await users.relogin(moderator.email)
  const moderatorContext = await browser.newContext()
  try {
    const moderatorPage = await moderatorContext.newPage()
    await stubExternalServices(moderatorPage)
    await loginAs(moderatorPage, moderatorSession)

    await moderatorPage.goto('/moderation')
    await expect(moderatorPage.getByRole('heading', { name: 'Panel de moderación' })).toBeVisible()
    // The queue is shared with any other pending flag in the DB: scope to ours.
    const flagItem = moderatorPage.getByRole('listitem').filter({ hasText: reason })
    await expect(flagItem.getByRole('link', { name: report.title })).toBeVisible()
    await flagItem.getByRole('button', { name: 'Resolver y ocultar' }).click()

    await expect(moderatorPage.getByText('Reporte ocultado y denuncia resuelta')).toBeVisible()
    await expect(moderatorPage.getByRole('listitem').filter({ hasText: reason })).toHaveCount(0)
  } finally {
    await moderatorContext.close()
  }

  // Hidden: only the owner can still see it, as rejected.
  const asOwner = await api.getReport(owner.token, report.id)
  expect(asOwner.body.status).toBe('rejected')
  const asReporter = await api.getReport(reporter.token, report.id)
  expect(asReporter.status).toBe(404)
})

test('F3: a regular user cannot open the moderation panel', async ({ page, users }) => {
  const regular = await users.create('f3-regular')

  await loginAs(page, regular)
  await page.goto('/moderation')

  // RequireRole sends an authenticated user without the role to the home page.
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Panel de moderación' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Moderación' })).toHaveCount(0)
  // And the backend enforces it regardless of the UI.
  expect((await api.listReportFlags(regular.token)).status).toBe(403)
})
