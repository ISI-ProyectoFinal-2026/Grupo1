import { expect, loginAs, test } from './fixtures.ts'
import * as api from './support/api.ts'

test('F12: a Premium business edits its public profile, publishes an ad and reads its metrics', async ({ page, users }) => {
  const owner = await users.create('f12-owner')
  const business = await api.createBusiness(owner.token, `Pet Shop F12 ${Date.now()}`)
  await api.subscribePremium(owner.token)

  await loginAs(page, owner)
  await page.goto('/businesses/dashboard')

  // perfil público: descripción y enlaces
  await page.getByLabel('Descripción').fill('Peluquería canina y alimento balanceado.')
  await page.getByLabel('Sitio web').fill('https://petshop-f12.com')
  await page.getByLabel('Redes sociales').fill('https://instagram.com/petshop_f12')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Cambios guardados')).toBeVisible()

  // alta de anuncio (la subida a R2 está simulada por los fixtures)
  await expect(page.getByText('0 de 3 anuncios activos')).toBeVisible()
  await page.getByRole('button', { name: 'Nuevo anuncio' }).click()
  await page.getByLabel('Título').fill('Baño y corte -20%')
  await page.getByLabel('Texto').fill('Turnos de lunes a sábado.')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'ad.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('e2e-ad'),
  })
  await page.getByLabel('Radio de alcance (km)').fill('12')
  await page.getByRole('button', { name: 'Publicar anuncio' }).click()

  const card = page.getByRole('article', { name: 'Baño y corte -20%' })
  await expect(card).toContainText('Activo')
  await expect(card).toContainText('Radio 12 km')
  await expect(page.getByText('1 de 3 anuncios activos')).toBeVisible()

  // pausar y reactivar
  await card.getByRole('button', { name: 'Pausar' }).click()
  await expect(card).toContainText('Pausado')
  await expect(page.getByText('0 de 3 anuncios activos')).toBeVisible()
  await card.getByRole('button', { name: 'Activar' }).click()
  await expect(card).toContainText('Activo')

  // métricas: eventos registrados por el endpoint público que usa el banner
  const adId = await page.evaluate(async () => {
    const auth = JSON.parse(window.localStorage.getItem('patitas-auth')!).state.token
    const res = await fetch('/api/businesses/me/ads', { headers: { Authorization: `Bearer ${auth}` } })
    return (await res.json())[0].id as number
  })
  await api.recordAdEvent(adId, 'impression', 'feed')
  await api.recordAdEvent(adId, 'impression', 'report_detail')
  await api.recordAdEvent(adId, 'impression', 'feed')
  await api.recordAdEvent(adId, 'impression', 'feed')
  await api.recordAdEvent(adId, 'click', 'feed')

  await card.getByRole('button', { name: 'Ver métricas' }).click()
  const stats = page.getByRole('region', { name: 'Métricas de Baño y corte -20%' })
  await expect(stats.getByTestId('ad-impressions')).toHaveText('4')
  await expect(stats.getByTestId('ad-clicks')).toHaveText('1')
  await expect(stats.getByTestId('ad-ctr')).toHaveText('25,0%')
  await expect(stats.getByRole('row', { name: /Feed 3 1/ })).toBeVisible()

  // el perfil público muestra lo cargado
  await page.goto(`/businesses/${business.id}`)
  await expect(page.getByText('Peluquería canina y alimento balanceado.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'petshop-f12.com' })).toHaveAttribute('href', 'https://petshop-f12.com')
  await expect(page.getByRole('link', { name: 'instagram.com/petshop_f12' })).toBeVisible()
})
