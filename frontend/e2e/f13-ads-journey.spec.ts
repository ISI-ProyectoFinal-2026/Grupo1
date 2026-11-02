import { dismissLocationConsent, expect, loginAs, stubExternalServices, test } from './fixtures.ts'
import * as api from './support/api.ts'
import { setRole } from './support/db.ts'

// lejos de los anuncios de otras suites (F12 publica en Buenos Aires): el único en el radio es el de F13
const CORDOBA = { lat: -31.4201, lng: -64.1888 }

test('F13: a nearby user sees the ad, opens the business, flags it and a moderator takes it down', async ({ browser, page, users }) => {
  const owner = await users.create('f13-owner')
  const businessName = `Veterinaria F13 ${Date.now()}`
  const business = await api.createBusiness(owner.token, businessName, CORDOBA)
  await api.subscribePremium(owner.token)
  const adTitle = `Vacunas F13 ${Date.now()}`
  const ad = await api.createAd(owner.token, adTitle)

  const neighbor = await users.create('f13-neighbor')
  await api.shareLocation(neighbor.token, CORDOBA)
  const report = await api.createPublishedReport(neighbor.token, {
    reportType: 'found',
    title: `Perro encontrado F13 ${Date.now()}`,
    location: CORDOBA,
  })

  // feed: banner segmentado por la ubicación del vecino (la app la refresca con la del navegador)
  await page.context().setGeolocation({ latitude: CORDOBA.lat, longitude: CORDOBA.lng })
  await loginAs(page, neighbor)
  await page.goto('/reports')
  const feedBanner = page.getByRole('complementary', { name: 'Publicidad' })
  // la impresión cuenta al entrar en pantalla: el banner va después de la 3.ª tarjeta
  await feedBanner.scrollIntoViewIfNeeded()
  await expect(feedBanner).toContainText(adTitle)
  await expect.poll(async () => (await api.getAdStats(owner.token, ad.id)).impressions).toBe(1)
  await expect(feedBanner).toContainText(businessName)

  // detalle del reporte: comercios cercanos con el Premium destacado y el banner
  await page.goto(`/reports/${report.id}`)
  const nearby = page.getByRole('list', { name: 'Comercios adheridos cerca' })
  const nearbyItem = nearby.getByRole('listitem').filter({ hasText: businessName })
  await expect(nearbyItem).toContainText('Destacado')
  const detailBanner = page.getByRole('complementary', { name: 'Publicidad' })
  await expect(detailBanner).toContainText(adTitle)

  // el clic lleva al perfil y suma en las métricas del comercio
  await detailBanner.getByRole('link', { name: new RegExp(adTitle) }).click()
  await expect(page).toHaveURL(new RegExp(`/businesses/${business.id}$`))
  await expect(page.getByRole('heading', { name: businessName })).toBeVisible()
  await expect.poll(async () => (await api.getAdStats(owner.token, ad.id)).clicks).toBe(1)
  await expect.poll(async () => (await api.getAdStats(owner.token, ad.id)).impressions).toBeGreaterThanOrEqual(2)

  // directorio: el comercio aparece destacado
  await page.goto('/businesses')
  await expect(page.getByRole('link', { name: new RegExp(businessName) })).toContainText('Destacado')

  // el vecino denuncia el anuncio desde el banner
  await page.goto(`/reports/${report.id}`)
  await detailBanner.getByRole('button', { name: 'Denunciar anuncio' }).click()
  await detailBanner.getByLabel('Motivo de la denuncia').fill('Promociona algo engañoso')
  await detailBanner.getByRole('button', { name: 'Enviar denuncia' }).click()
  await expect(detailBanner.getByRole('status')).toContainText('Recibimos tu denuncia')

  // un moderador lo da de baja
  const moderator = await users.create('f13-moderator')
  await setRole(moderator.user.id, 'moderador')
  const moderatorSession = await users.relogin(moderator.email)
  const moderatorContext = await browser.newContext()
  const moderatorPage = await moderatorContext.newPage()
  await stubExternalServices(moderatorPage)
  await dismissLocationConsent(moderatorPage)
  await loginAs(moderatorPage, moderatorSession)
  await moderatorPage.goto('/moderation')
  const flagged = moderatorPage.getByRole('listitem').filter({ hasText: 'Promociona algo engañoso' })
  await expect(flagged).toContainText(adTitle)
  await flagged.getByRole('button', { name: 'Dar de baja el anuncio' }).click()
  await expect(moderatorPage.getByText('Anuncio dado de baja')).toBeVisible()
  await moderatorContext.close()

  // el anuncio deja de mostrarse
  await page.goto(`/reports/${report.id}`)
  await expect(nearbyItem).toBeVisible()
  await expect(page.getByText(adTitle)).toHaveCount(0)
})
