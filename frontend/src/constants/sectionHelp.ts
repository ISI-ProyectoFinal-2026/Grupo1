import { matchPath } from 'react-router-dom'
import type { Role } from '@/types/auth'

export interface HelpGroup {
  heading?: string
  items: string[]
}

export interface ResolvedHelp {
  id: SectionId
  title: string
  can: HelpGroup[]
  steps: HelpGroup[]
}

export type SectionId =
  | 'home'
  | 'reports'
  | 'report-detail'
  | 'report-new'
  | 'reports-mine'
  | 'report-edit'
  | 'chats'
  | 'businesses'
  | 'business-profile'
  | 'business-register'
  | 'business-dashboard'
  | 'business-plan'
  | 'pets'
  | 'pet-new'
  | 'pet-edit'
  | 'account'
  | 'security'
  | 'notification-settings'
  | 'moderation'
  | 'sanctions'
  | 'admin-users'

interface SectionContent {
  can: HelpGroup[]
  steps?: HelpGroup[]
}

interface SectionDef extends SectionContent {
  title: string
  roles?: Role[]
  variants?: Partial<Record<Role, SectionContent>>
}

const g = (items: string[], heading?: string): HelpGroup => ({ heading, items })

const HOME_CAN = [
  'Ver los reportes de mascotas perdidas y encontradas desde "Reportes".',
  'Chatear con otras personas desde "Chats".',
  'Publicar una mascota perdida o encontrada con el botón destacado "Reportar".',
  'Explorar veterinarias, refugios y pet shops en "Comercios".',
  'Entrar a "Más" para "Mis mascotas", "Mis reportes", "Mi comercio", "Mi cuenta", "Notificaciones", tu email ("Seguridad de la cuenta") y "Cerrar sesión".',
  'Ver tus avisos en la campana "Notificaciones" del encabezado.',
]
const HOME_STEPS = [
  'En el celular usá la barra inferior; en la computadora, el menú lateral.',
  'Tocá la sección que necesites.',
  'Para lo demás, abrí "Más" (en la computadora está al pie del menú lateral).',
]

// ayuda contextual por sección y rol (issue #302)
export const SECTION_HELP: Record<SectionId, SectionDef> = {
  home: {
    title: 'Menú principal',
    can: [g(HOME_CAN)],
    steps: [g(HOME_STEPS)],
    variants: {
      moderador: {
        can: [g([...HOME_CAN, 'En "Más" también tenés "Moderación" para revisar denuncias y "Sanciones" para los casos de sanción.'])],
      },
      admin: {
        can: [
          g([
            ...HOME_CAN,
            'En "Más" también tenés "Moderación" para revisar denuncias, "Administración" para gestionar usuarios y "Sanciones" para los casos de sanción.',
          ]),
        ],
      },
    },
  },
  reports: {
    title: 'Reportes',
    can: [
      g([
        'Ver los reportes publicados, en "Lista" o en "Mapa" (el mapa carga la zona visible).',
        'Filtrar por "Tipo" (Todos, Perdidas, Encontradas), "Zona", "Desde" y "Hasta".',
        'Ver primero los más nuevos y cuántos hay ("N reportes").',
        'Crear un reporte con el botón "Crear Reporte".',
      ]),
    ],
    steps: [
      g([
        'Elegí "Lista" o "Mapa" en "Vista".',
        'Ajustá los filtros (en el celular, "Zona" y las fechas están en "Más filtros").',
        'Tocá una tarjeta para abrir el reporte.',
      ]),
    ],
  },
  'report-detail': {
    title: 'Reporte',
    can: [
      g(
        [
          'Ver fotos, tipo, "Ubicación", "Fecha", "Descripción" y "Estado" (Pendiente, Publicado, Rechazado, Oculto por denuncias o Resuelto).',
          'Ver las "Coincidencias sugeridas" con su porcentaje; mientras está pendiente aparece "Estamos procesando tu reporte…".',
          'Armar el "Flyer para compartir" con "Generar flyer", y después "Descargar" o "Compartir".',
        ],
        'En cualquier reporte'
      ),
      g(
        [
          '"Cerrar reporte" (solo si está publicado): pasa a "Resuelto".',
          '"Editar reporte" (no si está oculto) y "Eliminar reporte".',
          'Responder el aviso de inactividad con "Caso resuelto" o "Seguir mostrando".',
          'Confirmar o descartar coincidencias con "Confirmar coincidencia" y "Descartar".',
          'Si está oculto por denuncias, solo podés eliminarlo.',
        ],
        'Si el reporte es tuyo'
      ),
      g(
        [
          '"Contactar al autor" para abrir un chat (necesitás el email verificado).',
          '"Denunciar" el reporte, solo si está publicado.',
          '"Reportar cuenta" si el problema es la persona.',
        ],
        'Si es de otra persona'
      ),
    ],
    steps: [
      g(
        [
          'Para cerrarlo, tocá "Cerrar reporte" y después "Confirmar cierre".',
          'Para borrarlo, tocá "Eliminar reporte" y después "Confirmar eliminación".',
          'Para usar tu propio flyer, elegí "subí tu propio flyer".',
        ],
        'Si el reporte es tuyo'
      ),
      g(
        [
          'Para escribirle al autor, tocá "Contactar al autor".',
          'Para denunciar, tocá "Denunciar", elegí el "Motivo de la denuncia" ("Otro" pide "Detalle", hasta 500 caracteres) y tocá "Enviar denuncia".',
          'Para reportar la cuenta, tocá "Reportar cuenta", elegí la "Gravedad del problema" (Leve, Media o Fuerte) y tocá "Enviar reporte".',
        ],
        'Si es de otra persona'
      ),
    ],
  },
  'report-new': {
    title: 'Crear Reporte',
    can: [
      g([
        'Publicar una mascota perdida o encontrada.',
        'Cargar hasta 4 fotos (JPG, PNG o WebP): 1 principal y 3 extra. Se rechazan las fotos sin animal.',
        'Marcar la "Ubicación" en el mapa o con "Usar mi ubicación actual".',
        'Ver reportes parecidos ("¿Alguno de estos coincide con tu avistamiento?").',
        'Mostrar tu teléfono en el flyer con "Mostrar mi teléfono en el flyer" (si cargaste uno).',
        'Para publicar necesitás el email verificado; el reporte queda "Pendiente" hasta la revisión automática.',
      ]),
    ],
    steps: [
      g([
        'Elegí "Tipo de reporte": "Mascota Perdida" o "Mascota Encontrada".',
        'Si es perdida y tenés mascotas cargadas, elegí tu "Mascota" para completar datos y fotos.',
        'Completá "Título", "Fecha del suceso" (no puede ser futura) y "Descripción".',
        'Agregá "Fotos" con "Tocá para elegir fotos" y marcá la principal con "Hacer principal".',
        'Marcá la "Ubicación" tocando el mapa y arrastrando el pin, y tocá "Crear Reporte".',
      ]),
    ],
  },
  'reports-mine': {
    title: 'Mis reportes',
    can: [
      g([
        'Ver todos tus reportes con su "Estado".',
        'Abrirlos con "Ver".',
        'Cambiarlos con "Editar" (no disponible si están ocultos).',
        'Borrarlos con "Eliminar reporte", con confirmación.',
        'Crear otro con "Nuevo reporte".',
      ]),
    ],
    steps: [g(['Buscá el reporte en la lista.', 'Tocá "Ver", "Editar" o "Eliminar reporte".', 'Si eliminás, confirmá en el aviso.'])],
  },
  'report-edit': {
    title: 'Editar reporte',
    can: [
      g([
        'Corregir los datos de tu reporte (solo su autor puede editarlo).',
        'Cambiar las fotos: el reporte vuelve a revisión.',
        'Los reportes resueltos no permiten cambiar las fotos.',
      ]),
    ],
    steps: [g(['Modificá los campos que necesites.', 'Tocá "Guardar cambios".'])],
  },
  chats: {
    title: 'Chats',
    can: [
      g([
        'Ver tus conversaciones en "Conversaciones": cada una aparece como "Reporte #N".',
        'Escribir en el campo "Mensaje" y tocar "Enviar".',
        'Mandar imágenes (JPG, PNG o WebP) con "Adjuntar imagen".',
        'Ver el estado de la conexión.',
        'Los chats se crean con "Contactar al autor" en el reporte de otra persona; para enviar mensajes necesitás el email verificado.',
      ]),
    ],
    steps: [
      g([
        'Elegí una conversación en "Conversaciones".',
        'Escribí en "Mensaje".',
        'Tocá "Enviar" (o "Adjuntar imagen" para mandar una foto).',
      ]),
    ],
  },
  businesses: {
    title: 'Comercios',
    can: [
      g([
        'Explorar el directorio público de comercios, en el mapa y en tarjetas.',
        'Filtrar por "Rubro": Todos, Veterinaria, Refugio, Pet shop u Otro.',
        'Abrir el perfil de un comercio desde su tarjeta.',
      ]),
    ],
    steps: [g(['Elegí un "Rubro".', 'Tocá una tarjeta para ver el perfil.'])],
  },
  'business-profile': {
    title: 'Comercio',
    can: [
      g([
        'Ver rubro, "Domicilio", "Teléfono", mapa, descripción y "Enlaces".',
        'Si iniciaste sesión, tocar "Contactar" para registrar tu interés.',
        'Volver con "Volver al directorio".',
      ]),
    ],
  },
  'business-register': {
    title: 'Registrar comercio',
    can: [
      g([
        'Dar de alta tu comercio: arranca en el plan Gratis.',
        'Solo el plan Premium puede publicar anuncios.',
        'Si ya tenés un comercio, te lleva a su panel.',
      ]),
    ],
    steps: [
      g([
        'Completá "Nombre", "CUIT", "Domicilio", "Teléfono" y "Rubro" (Veterinaria, Refugio o Pet shop).',
        'Marcá la "Ubicación en el mapa" (es obligatoria).',
        'Tocá "Registrar comercio".',
      ]),
    ],
  },
  'business-dashboard': {
    title: 'Panel del comercio',
    can: [
      g([
        'Ver las "Estadísticas": "Vistas" y "Contactos".',
        'Gestionar la "Suscripción": "Renovar" o "Pasar a Premium".',
        'Editar los "Datos del comercio" con "Guardar cambios".',
        'Administrar "Anuncios": hasta 3 activos ("N de 3 anuncios activos"); requiere plan Premium vigente y ubicación del comercio.',
      ]),
    ],
    steps: [
      g([
        'Tocá "Nuevo anuncio".',
        'Completá "Título", "Texto", "Imagen" y "Radio de alcance (km)".',
        'Tocá "Publicar anuncio".',
        'En cada anuncio podés usar "Editar", "Pausar" o "Activar", "Ver métricas" y "Eliminar".',
      ]),
    ],
  },
  'business-plan': {
    title: 'Plan Premium',
    can: [
      g([
        'Hasta 3 anuncios activos.',
        'Anuncios segmentados por cercanía, hasta 20 km.',
        'Tu comercio destacado en el directorio y cerca de cada reporte.',
        'Métricas de impresiones y clics.',
        'El pago es simulado: no se cobra nada real.',
      ]),
    ],
    steps: [
      g([
        'Elegí "Mensual" o "Anual" en "Elegí cómo pagar".',
        'Tocá "Pasar a Premium" (o "Renovar Premium").',
        'Volvé con "Volver al panel".',
      ]),
    ],
  },
  pets: {
    title: 'Mis mascotas',
    can: [
      g([
        'Ver tus mascotas cargadas.',
        'Agregar una con "Agregar mascota".',
        'Cambiarlas con "Editar" o borrarlas con "Eliminar" (con confirmación).',
        'Usarlas al crear un reporte de mascota perdida.',
      ]),
    ],
    steps: [g(['Tocá "Agregar mascota".', 'Completá los datos y guardá.'])],
  },
  'pet-new': {
    title: 'Agregar mascota',
    can: [g(['Cargar los datos de tu mascota para reutilizarlos en reportes de mascota perdida.'])],
    steps: [
      g([
        'Completá "Nombre", "Especie", "Raza", "Edad (años)", "Color" y "Descripción" ("Microchip" es opcional).',
        'Agregá hasta 4 "Fotos".',
        'Tocá "Agregar mascota".',
      ]),
    ],
  },
  'pet-edit': {
    title: 'Editar mascota',
    can: [g(['Actualizar los datos de tu mascota (solo podés editar las tuyas).'])],
    steps: [g(['Modificá lo que necesites.', 'Tocá "Guardar cambios".'])],
  },
  account: {
    title: 'Mi cuenta',
    can: [
      g([
        'Cargar o corregir tu "Nombre" y tu "Teléfono". El teléfono es opcional y aparece en el flyer de un reporte solo si marcás "Mostrar mi teléfono en el flyer" al crearlo.',
        'Descargar una copia de tus datos en un archivo JSON con "Descargar mis datos" (hasta 5 veces por hora).',
        'Eliminar tu cuenta con "Eliminar mi cuenta". Es definitivo: se borran tus mascotas, reportes, chats y, si tenés, tu comercio.',
        'No podés eliminarla con una sanción vigente o en revisión, con un comercio con plan Premium vigente ni si sos el único administrador.',
      ]),
    ],
    steps: [
      g([
        'Para editar tus datos, modificá los campos y tocá "Guardar cambios".',
        'Para eliminar la cuenta, tocá "Eliminar mi cuenta", ingresá tu contraseña (y un código si tenés la verificación en dos pasos) y tocá "Eliminar definitivamente".',
      ]),
    ],
  },
  security: {
    title: 'Seguridad de la cuenta',
    can: [
      g([
        'Activar o desactivar la verificación en dos pasos (es lo único que hay acá; no hay cambio de contraseña).',
        'Para activarla necesitás el email verificado.',
        'Con la verificación activa, generar códigos de recuperación nuevos con "Generar códigos de recuperación nuevos".',
      ]),
    ],
    steps: [
      g([
        'Tocá "Activar verificación en dos pasos".',
        'Escaneá el QR o escribí la clave en tu app.',
        'Ingresá el "Código de 6 dígitos" y tocá "Confirmar y activar".',
        'Guardá los códigos de recuperación.',
        'Para apagarla, tocá "Desactivar la verificación en dos pasos": pide tu contraseña y un código de la app o de recuperación.',
      ]),
    ],
  },
  'notification-settings': {
    title: 'Notificaciones',
    can: [
      g([
        'Elegir qué avisos recibir: "Posible coincidencia", "Mensaje nuevo", "Cambio de estado de mi reporte" y "Nuevo reporte en mi zona".',
        '"Nuevo reporte en mi zona" se desactiva si no diste permiso de ubicación.',
        'Ajustar el "Radio" (1, 2, 5 o 10 km) y el "Tipo de reporte" (Perdidos, Encontrados o Ambos).',
        'Activar o quitar la ubicación con "Activar ubicación" o "Dejar de compartir mi ubicación".',
      ]),
    ],
    steps: [
      g(['Activá o desactivá cada aviso con su interruptor.', 'Elegí "Radio" y "Tipo de reporte".', 'Los cambios se guardan solos.']),
    ],
  },
  moderation: {
    title: 'Panel de moderación',
    roles: ['moderador', 'admin'],
    can: [
      g([
        'Revisar la cola, agrupada por reporte denunciado.',
        '"Ocultos pendientes de revisión": "Restaurar" o "Confirmar ocultamiento" (definitivo, no se puede restaurar).',
        '"Publicados con denuncias": "Descartar" o "Ocultar".',
        '"Cuentas denunciadas": lista informativa; con 5 denuncias de personas distintas la cuenta pasa a "Sanciones pendientes".',
        '"Anuncios denunciados": "Desestimar" o "Dar de baja el anuncio".',
      ]),
    ],
    steps: [
      g(['Elegí el bloque de la cola.', 'Revisá el reporte o anuncio denunciado.', 'Tocá la acción que corresponda.']),
    ],
  },
  sanctions: {
    title: 'Sanciones pendientes',
    roles: ['moderador', 'admin'],
    can: [
      g([
        'Ver un caso por tarjeta: nombre, email, rol, tipo de caso y conteos "Leves / Medias / Fuertes".',
        'Decidir con "Confirmar sanción" (o "Confirmar y eliminar cuenta" en un caso provisional) o con "Revertir".',
        'Eliminar una cuenta es definitivo.',
        'No podés decidir sobre tu propia sanción.',
      ]),
    ],
    steps: [g(['Abrí el caso y tocá "Confirmar sanción" o "Revertir".', 'Completá el "Motivo" (obligatorio).', 'Confirmá.'])],
    variants: {
      moderador: {
        can: [
          g([
            'Ver un caso por tarjeta: nombre, email, rol, tipo de caso y conteos "Leves / Medias / Fuertes".',
            'Decidir con "Confirmar sanción" (o "Confirmar y eliminar cuenta" en un caso provisional) o con "Revertir".',
            'Como moderador, decidís solo los casos de reincidencia (suspensión provisional de un usuario).',
            'Eliminar una cuenta es definitivo.',
            'No podés decidir sobre tu propia sanción.',
          ]),
        ],
      },
      admin: {
        can: [
          g([
            'Ver un caso por tarjeta: nombre, email, rol, tipo de caso y conteos "Leves / Medias / Fuertes".',
            'Decidir con "Confirmar sanción" (o "Confirmar y eliminar cuenta" en un caso provisional) o con "Revertir".',
            'Como administrador, decidís cualquier caso.',
            'Eliminar una cuenta es definitivo.',
            'No podés decidir sobre tu propia sanción ni sancionar al último administrador activo.',
          ]),
        ],
      },
    },
  },
  'admin-users': {
    title: 'Usuarios',
    roles: ['admin'],
    can: [
      g([
        'Buscar con "Buscar por nombre o email" y filtrar con "Filtrar por rol".',
        'Ver la tabla Nombre / Email / Rol (20 por página).',
        'Cambiar el rol de otra persona con el selector de su fila.',
        'No podés cambiar tu propio rol y siempre debe quedar al menos un administrador.',
        'Consultar el "Registro de cambios de rol" al final de la página.',
      ]),
    ],
    steps: [
      g(['Buscá o filtrá a la persona.', 'Elegí el nuevo rol en el selector de su fila.', 'Confirmá en el cuadro de diálogo.']),
    ],
  },
}

// de lo más específico a lo más general
export const SECTION_ROUTES: { pattern: string; id: SectionId }[] = [
  { pattern: '/', id: 'home' },
  { pattern: '/reports/new', id: 'report-new' },
  { pattern: '/reports/mine', id: 'reports-mine' },
  { pattern: '/reports/:id/edit', id: 'report-edit' },
  { pattern: '/reports/:id', id: 'report-detail' },
  { pattern: '/reports', id: 'reports' },
  { pattern: '/chats/:id', id: 'chats' },
  { pattern: '/chats', id: 'chats' },
  { pattern: '/businesses/register', id: 'business-register' },
  { pattern: '/businesses/dashboard', id: 'business-dashboard' },
  { pattern: '/businesses/plan', id: 'business-plan' },
  { pattern: '/businesses/:id', id: 'business-profile' },
  { pattern: '/businesses', id: 'businesses' },
  { pattern: '/pets/new', id: 'pet-new' },
  { pattern: '/pets/:id/edit', id: 'pet-edit' },
  { pattern: '/pets', id: 'pets' },
  { pattern: '/account/profile', id: 'account' },
  { pattern: '/account/security', id: 'security' },
  { pattern: '/account/notifications', id: 'notification-settings' },
  { pattern: '/moderation', id: 'moderation' },
  { pattern: '/admin/sanctions', id: 'sanctions' },
  { pattern: '/admin/users', id: 'admin-users' },
]

function build(id: SectionId, role: Role): ResolvedHelp {
  const def = SECTION_HELP[id]
  const content = def.variants?.[role] ?? def
  return { id, title: def.title, can: content.can, steps: content.steps ?? def.steps ?? [] }
}

export function resolveSectionHelp(pathname: string, role: Role): ResolvedHelp {
  const route = SECTION_ROUTES.find((r) => matchPath(r.pattern, pathname))
  const id = route?.id ?? 'home'
  const roles = SECTION_HELP[id].roles
  return build(roles && !roles.includes(role) ? 'home' : id, role)
}
