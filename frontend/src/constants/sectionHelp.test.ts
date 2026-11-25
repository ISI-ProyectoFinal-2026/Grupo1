import { describe, expect, it } from 'vitest'
import { resolveSectionHelp, SECTION_HELP, SECTION_ROUTES } from '@/constants/sectionHelp'
import type { Role } from '@/types/auth'

const ROLES: Role[] = ['usuario_regular', 'moderador', 'admin']

function textOf(path: string, role: Role) {
  const help = resolveSectionHelp(path, role)
  return JSON.stringify([help.can, help.steps])
}

describe('resolveSectionHelp', () => {
  it.each([
    ['/', 'home'],
    ['/reports', 'reports'],
    ['/reports/new', 'report-new'],
    ['/reports/mine', 'reports-mine'],
    ['/reports/12', 'report-detail'],
    ['/reports/12/edit', 'report-edit'],
    ['/chats', 'chats'],
    ['/chats/3', 'chats'],
    ['/businesses', 'businesses'],
    ['/businesses/9', 'business-profile'],
    ['/businesses/register', 'business-register'],
    ['/businesses/dashboard', 'business-dashboard'],
    ['/businesses/plan', 'business-plan'],
    ['/pets', 'pets'],
    ['/pets/new', 'pet-new'],
    ['/pets/4/edit', 'pet-edit'],
    ['/account/profile', 'account'],
    ['/account/security', 'security'],
    ['/account/notifications', 'notification-settings'],
    ['/ruta-que-no-existe', 'home'],
    ['/reports/12/otra-cosa', 'home'],
  ])('%s resuelve a %s', (path, id) => {
    expect(resolveSectionHelp(path, 'usuario_regular').id).toBe(id)
  })

  it('tolera la barra final', () => {
    expect(resolveSectionHelp('/reports/new/', 'usuario_regular').id).toBe('report-new')
  })

  it.each([
    ['/moderation', 'moderation', [false, true, true]],
    ['/admin/sanctions', 'sanctions', [false, true, true]],
    ['/admin/users', 'admin-users', [false, false, true]],
  ])('%s solo existe para los roles que pueden entrar', (path, id, allowed) => {
    ROLES.forEach((role, index) => {
      expect(resolveSectionHelp(path, role).id).toBe(allowed[index] ? id : 'home')
    })
  })

  it('el menú principal difiere según el rol', () => {
    const [usuario, moderador, admin] = ROLES.map((role) => textOf('/', role))
    expect(new Set([usuario, moderador, admin]).size).toBe(3)
    expect(usuario).not.toContain('Moderación')
    expect(usuario).not.toContain('Administración')
    expect(moderador).toContain('Moderación')
    expect(moderador).toContain('Sanciones')
    expect(moderador).not.toContain('Administración')
    expect(admin).toContain('Moderación')
    expect(admin).toContain('Administración')
    expect(admin).toContain('Sanciones')
  })

  it('las sanciones difieren entre moderador y administrador', () => {
    const moderador = textOf('/admin/sanctions', 'moderador')
    const admin = textOf('/admin/sanctions', 'admin')
    expect(moderador).not.toBe(admin)
    expect(moderador).toContain('reincidencia')
    expect(admin).toContain('cualquier caso')
    expect(moderador).not.toContain('cualquier caso')
  })

  it('el detalle de reporte separa los casos propio y ajeno', () => {
    const headings = resolveSectionHelp('/reports/1', 'usuario_regular').can.map((group) => group.heading)
    expect(headings).toEqual(['En cualquier reporte', 'Si el reporte es tuyo', 'Si es de otra persona'])
  })

  it('toda sección está en una ruta y toda ruta apunta a una sección', () => {
    const ids = SECTION_ROUTES.map((route) => route.id)
    expect(new Set(ids)).toEqual(new Set(Object.keys(SECTION_HELP)))
  })

  it.each(Object.keys(SECTION_HELP))('la sección %s tiene contenido completo para cada rol', (id) => {
    const route = SECTION_ROUTES.find((r) => r.id === id)!
    const path = route.pattern.replace(':id', '1')
    const allowed = ROLES.filter((role) => resolveSectionHelp(path, role).id === id)
    expect(allowed.length).toBeGreaterThan(0)
    allowed.forEach((role) => {
      const help = resolveSectionHelp(path, role)
      expect(help.title.length).toBeGreaterThan(0)
      expect(help.can.length).toBeGreaterThan(0)
      help.can.forEach((group) => expect(group.items.length).toBeGreaterThan(0))
      help.steps.forEach((group) => expect(group.items.length).toBeGreaterThan(0))
    })
  })
})
