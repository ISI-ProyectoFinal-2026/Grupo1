import { expect, loginAs, test } from './fixtures.ts'
import * as api from './support/api.ts'
import { setRole } from './support/db.ts'

test('F14: an admin promotes a user to moderator, the change is audited and the user is notified', async ({
  page,
  users,
}) => {
  const admin = await users.create('f14-admin')
  const target = await users.create('f14-target')

  // The role travels in the login response, so promote BEFORE logging in.
  await setRole(admin.user.id, 'admin')
  await loginAs(page, await users.relogin(admin.email))

  await page.goto('/')
  await page.getByRole('link', { name: 'Administración' }).click()
  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible()

  await page.getByLabel('Buscar por nombre o email').fill(target.email)
  const roleSelect = page.getByLabel(`Rol de ${target.email}`)
  await expect(roleSelect).toHaveValue('usuario_regular')
  // The admin cannot change their own role.
  await page.getByLabel('Buscar por nombre o email').fill(admin.email)
  await expect(page.getByLabel(`Rol de ${admin.email}`)).toBeDisabled()
  await page.getByLabel('Buscar por nombre o email').fill(target.email)

  await roleSelect.selectOption('moderador')
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirmar' }).click()
  await expect(dialog).toHaveCount(0)

  await expect(roleSelect).toHaveValue('moderador')

  // Newest first: our entry is on the first page of the audit log.
  const auditLog = page.getByRole('region', { name: 'Registro de cambios de rol' })
  const auditRow = auditLog.getByRole('row').filter({ hasText: target.email })
  await expect(auditRow).toContainText(admin.email)
  await expect(auditRow).toContainText('Usuario')
  await expect(auditRow).toContainText('Moderador')

  // The affected user is told, regardless of notification preferences.
  const notifications = await api.listNotifications(target.token)
  expect(notifications.body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'role_change', title: 'Tu rol cambió' }),
    ])
  )
  // And the new role applies on their next login.
  expect((await users.relogin(target.email)).user.role).toBe('moderador')
})

test('F14: a moderator cannot see or open the admin area', async ({ page, users }) => {
  const moderator = await users.create('f14-mod')

  await setRole(moderator.user.id, 'moderador')
  const session = await users.relogin(moderator.email)
  await loginAs(page, session)

  await page.goto('/moderation')
  await expect(page.getByRole('heading', { name: 'Panel de moderación' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Administración' })).toHaveCount(0)

  await page.goto('/admin/users')
  // RequireRole sends an authenticated user without the role to the home page.
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Usuarios' })).toHaveCount(0)
  // And the backend enforces it regardless of the UI.
  expect((await api.listAdminUsers(session.token)).status).toBe(403)
})
