import { expect, loginAs, test } from './fixtures.ts'
import * as api from './support/api.ts'

const REPORT_TYPES = [
  { reportType: 'lost', label: 'perdido', title: 'Loro perdido' },
  { reportType: 'found', label: 'encontrado', title: 'Loro encontrado' },
] as const

for (const { reportType, label, title } of REPORT_TYPES) {
  test(`F4: the owner closes a published ${label} report and it shows as resolved`, async ({ page, users }) => {
    const owner = await users.create(`f4-owner-${reportType}`)
    const report = await api.createPublishedReport(owner.token, { reportType, title: `${title} F4 ${Date.now()}` })

    await loginAs(page, owner)
    await page.goto(`/reports/${report.id}`)
    await expect(page.getByText('Estado: Publicado')).toBeVisible()

    await page.getByRole('button', { name: 'Cerrar reporte' }).click()
    await page.getByRole('button', { name: 'Confirmar cierre' }).click()

    await expect(page.getByText('Estado: Resuelto')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cerrar reporte' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Confirmar cierre' })).toHaveCount(0)

    await page.reload()
    await expect(page.getByText('Estado: Resuelto')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cerrar reporte' })).toHaveCount(0)
  })

  test(`F4: a closed ${label} report leaves the feed and keeps its history`, async ({ page, users }) => {
    const owner = await users.create(`f4-feed-${reportType}`)
    const report = await api.createPublishedReport(owner.token, { reportType, title: `${title} feed F4 ${Date.now()}` })

    await loginAs(page, owner)
    await page.goto('/reports')
    await expect(page.getByRole('heading', { name: report.title })).toBeVisible()

    await page.goto(`/reports/${report.id}`)
    await page.getByRole('button', { name: 'Cerrar reporte' }).click()
    await page.getByRole('button', { name: 'Confirmar cierre' }).click()
    await expect(page.getByText('Estado: Resuelto')).toBeVisible()

    await page.goto('/reports')
    await expect(page.getByRole('heading', { name: report.title })).toHaveCount(0)

    const stored = await api.getReport(owner.token, report.id)
    expect(stored.status).toBe(200)
    expect(stored.body.status).toBe('resolved')
  })
}
