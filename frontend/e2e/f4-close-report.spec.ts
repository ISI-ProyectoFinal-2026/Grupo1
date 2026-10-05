import { expect, loginAs, test } from './fixtures.ts'
import * as api from './support/api.ts'

test('F4: the owner closes a published report and it shows as resolved', async ({ page, users }) => {
  const owner = await users.create('f4-owner')
  const report = await api.createReport(owner.token, { reportType: 'lost', title: `Loro perdido F4 ${Date.now()}` })

  await loginAs(page, owner)
  await page.goto(`/reports/${report.id}`)
  await expect(page.getByText('Estado: published')).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar reporte' }).click()
  await page.getByRole('button', { name: 'Confirmar cierre' }).click()

  await expect(page.getByText('Estado: resolved')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar reporte' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Confirmar cierre' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByText('Estado: resolved')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar reporte' })).toHaveCount(0)
})
