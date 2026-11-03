# Diagrama de casos de uso de PATITAS

Modelo de casos de uso del sistema PATITAS, en PlantUML. Corresponde a la sección 1.2.2.1 del informe y al Anexo N.º 5.

- **Commit analizado:** `f518b9a` (rama `main`, 2026-11-02).
- **Fuente editable:** `casos-de-uso.puml`.

## Archivos

| Archivo | Contenido | Estado |
| --- | --- | --- |
| `casos-de-uso.puml` | Siete diagramas: el general (`casos-de-uso`) y uno por módulo (`casos-de-uso-<módulo>`). | Generado |
| `casos-de-uso.svg` | Exportación vectorial. | Generado |
| `casos-de-uso.png` | Exportación estática. | Generado |
| `casos-de-uso-<módulo>.svg` / `.png` | Exportaciones de los seis diagramas por módulo. | Generado |

Las exportaciones se generaron el 2026-11-02 con PlantUML 1.2025.4, Eclipse Temurin JRE 21 y Graphviz. La sintaxis se validó con `-checkonly` sin errores. Para regenerarlas:

```bash
java -jar plantuml.jar -charset UTF-8 -tsvg casos-de-uso.puml
java -jar plantuml.jar -charset UTF-8 -tpng casos-de-uso.puml
```

Cada bloque `@startuml <nombre>` produce un archivo con ese nombre: `casos-de-uso.svg`/`.png` es el diagrama general y los módulos salen como `casos-de-uso-<módulo>.svg`/`.png`.

Para reducir cruces de líneas, el diagrama general muestra solo actores, casos de uso principales y asociaciones, con los actores distribuidos a ambos lados del límite del sistema. Las relaciones `<<include>>` y `<<extend>>`, los casos de uso incluidos o extendidos (CU-04, CU-05, CU-11, CU-12, CU-13, CU-14, CU-20, CU-26, CU-30) y los sistemas externos figuran únicamente en los diagramas por módulo.

## Alcance

El límite del sistema es la plataforma PATITAS completa: frontend web, API (`backend/`) y Backend IA (`backend-ia/`). El Backend IA es un componente propio del monorepo (ADR-0001, ADR-0005), por eso su análisis de imágenes es un caso de uso del sistema y no un actor.

Se representan los objetivos funcionales que un actor puede cumplir desde la interfaz o que el sistema ejecuta por tiempo. No se representan endpoints, servicios ni funciones internas.

| Módulo | Casos de uso | Implementados | Planificados |
| --- | --- | --- | --- |
| Cuenta y seguridad | CU-01 a CU-08 | 7 | 1 |
| Mascotas y reportes | CU-09 a CU-19 | 11 | 0 |
| IA y coincidencias | CU-20 a CU-23 | 4 | 0 |
| Comunicación | CU-24 a CU-30 | 7 | 0 |
| Comercios y publicidad | CU-31 a CU-40 | 10 | 0 |
| Moderación | CU-41 a CU-46 | 4 | 2 |
| **Total** | **46** | **43** | **3** |

**Convención de estado.** Un caso de uso es *implementado* cuando existe en el código del commit analizado y es accesible para su actor. Es *planificado* cuando figura en un issue abierto y no tiene implementación; se dibuja con el estereotipo `<<planificado>>` y borde punteado. Los requerimientos excluidos del MVP por el equipo (RF-37 a RF-40, gamificación) no se dibujan.

## Actores

### Principales

| Actor | Definición en el sistema | Fuente |
| --- | --- | --- |
| Visitante | Persona sin sesión. Se registra, inicia sesión y recupera su cuenta. | `frontend/src/router.tsx:38-50`; `backend/src/routes/auth.routes.ts:31-47` |
| Usuario registrado | Cuenta con rol `usuario_regular`. Puede usar la aplicación con el correo sin verificar, salvo las acciones del usuario verificado. | `backend/prisma/schema.prisma:18-24`; `frontend/src/router.tsx:51-70` |
| Usuario verificado | Especializa al usuario registrado: tiene el correo verificado, condición que la API exige para publicar reportes, subir imágenes, chatear, activar el 2FA y publicar anuncios. No es un rol: es un permiso. | `backend/src/middlewares/auth.middleware.ts:110`; `backend/src/routes/reports.routes.ts:22`; `backend/src/routes/uploads.routes.ts:17`; `backend/src/routes/chats.routes.ts:8`, `:10`; `backend/src/routes/auth.routes.ts:35-36`; `backend/src/routes/business-ads.routes.ts:10-12` |
| Titular de comercio | Especializa al usuario registrado: tiene un perfil de comercio vinculado. No es un rol (ADR-0019). | `backend/src/routes/businesses.routes.ts:11-16`; `docs/adr/0019-comercio-perfil-no-rol.md` |
| Moderador | Rol `moderador`. Especializa al usuario registrado y resuelve denuncias de reportes y de anuncios. | `backend/src/routes/report-flags.routes.ts:10-11`; `backend/src/routes/ad-flags.routes.ts:8-9`; `frontend/src/router.tsx:75-78` |
| Administrador | Rol `admin`. Especializa al moderador: hoy tiene exactamente sus mismos permisos y solo se crea con el seed. | `backend/prisma/seed.ts:17-21`; `backend/src/routes/report-flags.routes.ts:10-11`; issue #224 |
| Temporizador | Proceso de la API que cada 5 minutos reprocesa los reportes que siguen pendientes de análisis. | `backend/src/services/matching.service.ts:261-263`, `:315` |

### Secundarios

| Actor | Participa en | Fuente |
| --- | --- | --- |
| Servidor SMTP | Registrarse, Verificar el correo electrónico, Reiniciar el segundo factor, Recuperar la contraseña | `backend/src/services/mail/smtp-mail-sender.ts`; `backend/src/services/auth.service.ts:31-33` |
| Cloudflare R2 | Adjuntar la foto de la mascota, Enviar una imagen en el chat, Generar y compartir el flyer | `backend/src/services/storage.service.ts`; `backend/src/routes/uploads.routes.ts:17`; ADR-0008 |
| OpenStreetMap y Nominatim | Indicar la ubicación, Consultar el mapa de reportes | `frontend/src/components/maps/LocationPicker.tsx`; `frontend/src/components/maps/OsmTileLayer.tsx`; ADR-0009 |

### Generalizaciones

- Usuario verificado → Usuario registrado: el verificado hereda todo lo del registrado y agrega las acciones protegidas por `requireVerifiedEmail`.
- Titular de comercio → Usuario registrado: el comercio es un perfil de un usuario (ADR-0019).
- Moderador → Usuario registrado: el rol se asigna a una cuenta de usuario; las rutas de usuario solo exigen sesión.
- Administrador → Moderador: `admin` tiene los mismos permisos que `moderador` y ninguno propio (issue #224).

## Relaciones `include` y `extend`

| Relación | Justificación | Fuente |
| --- | --- | --- |
| Publicar un reporte `<<include>>` Indicar la ubicación | La ubicación es obligatoria en el alta. | `backend/src/validators/reports.validator.ts:11` |
| Publicar un reporte `<<include>>` Adjuntar la foto de la mascota | La foto es obligatoria desde el commit `e545c61`. | `backend/src/validators/reports.validator.ts:10`; `backend/src/services/reports.service.ts:159-165` |
| Publicar un reporte `<<include>>` Analizar la foto con IA | Todo alta verifica que la foto contenga un animal y queda pendiente hasta el veredicto del Backend IA. | `backend/src/services/reports.service.ts:131-149`, `:185` |
| Reprocesar reportes pendientes `<<include>>` Analizar la foto con IA | La reconciliación vuelve a ejecutar el mismo análisis. | `backend/src/services/matching.service.ts:261-315` |
| Vincular una mascota registrada `<<extend>>` Publicar un reporte | `petId` es opcional; solo aplica si el usuario tiene mascotas. | `backend/src/validators/reports.validator.ts:6`; `frontend/src/components/reports/PetSelect.tsx` |
| Revisar reportes similares `<<extend>>` Publicar un reporte | Las sugerencias de posibles duplicados aparecen solo si existen reportes similares (#211). | `backend/src/routes/reports.routes.ts:23-24`; `frontend/src/components/reports/SimilarReportsSuggestions.tsx` |
| Ingresar el segundo factor `<<extend>>` Iniciar sesión | Solo si la cuenta tiene el 2FA activo. | `backend/src/routes/auth.routes.ts:32-33` |
| Reiniciar el segundo factor `<<extend>>` Ingresar el segundo factor | Solo si el usuario perdió el acceso al segundo factor; se ofrece desde el inicio de sesión. | `backend/src/services/two-factor/reset.ts:42`; `frontend/src/pages/auth/Login.tsx` |
| Enviar una imagen en el chat `<<extend>>` Intercambiar mensajes | La imagen es opcional en el mensaje. | `backend/src/validators/chats.validator.ts:13-20` |
| Subir un flyer personalizado `<<extend>>` Generar y compartir el flyer | Opcional y solo para el autor del reporte. | `backend/src/routes/reports.routes.ts:47` |

No se usaron otras relaciones `include` o `extend`: en el resto de los casos no hay un comportamiento obligatorio compartido ni un punto de extensión condicional verificable.

## Supuestos

1. "Dueño" y "persona que encuentra" no se modelan como actores: el tipo de reporte (`lost`/`found`) es un atributo del reporte, no un rol ni un permiso.
2. El Backend IA y el proveedor de pago simulado (`backend/src/services/payments/fake-payment-provider.ts`) quedan dentro del límite del sistema. No se dibuja una pasarela de pago porque no existe (ADR-0024).
3. Editar, eliminar y cerrar un reporte se asignan al usuario verificado: la API solo exige sesión y autoría, pero solo un usuario verificado puede haber creado el reporte.
4. "Suspender una cuenta" (issue #38) se asocia al moderador. El issue dice "como sistema" y no nombra al actor; la asociación surge del epic `moderación`.

## Funcionalidades parciales no dibujadas como casos de uso

| Funcionalidad | Situación | Fuente |
| --- | --- | --- |
| Búsqueda por radio de cercanía (RF-22) | Solo en la API (`/api/geo/nearby`); el frontend no la consume. | `backend/src/routes/geo.routes.ts:6`; `frontend/src/services/geo.service.ts` |
| Filtro por raza (RF-10) | Solo en la API; el feed no lo ofrece. | `backend/src/services/reports.service.ts:89`; `backend/src/validators/reports.validator.ts:41`; `frontend/src/pages/reports/FeedPage.tsx` |
| Notificación de cambios de estado (RF-16) | Solo por el veredicto de la IA; no al cerrar ni al ocultar por denuncia. | `backend/src/services/matching.service.ts:87` |
| Pasarela de pago real (RF-34) | Pago simulado; la pasarela está prevista en ADR-0024 sin issue identificado. | `docs/adr/0024-modelo-monetizacion.md:8`, `:47` |

## Fuentes

- Requerimientos: `docs/pdd/PDD v1.0.docx` y su trazabilidad en `docs/informe/1-2-2-modelo-funcional.md` (Tablas 1.2.2-23 y 1.2.2-24).
- Historias de usuario: `docs/informe/1-2-2-2-historias-y-flujos.md` e issues del repositorio (#38, #187, #211, #219, #224, #225).
- Roles y permisos: `backend/prisma/schema.prisma:18-24`, `backend/src/middlewares/auth.middleware.ts`, `backend/src/routes/*.routes.ts`, `frontend/src/router.tsx`, `frontend/src/components/RequireRole.tsx`.
- Decisiones: ADR-0001, ADR-0005, ADR-0008, ADR-0009, ADR-0019, ADR-0024.

## Pendientes

- El diagrama general conserva cruces entre las asociaciones de Usuario registrado y Usuario verificado, y las generalizaciones de Titular de comercio y Moderador rodean el límite del sistema. Los diagramas por módulo son la referencia de detalle.
- Registrar la ejecución en `../../control/registro-ejecuciones.md` y las fuentes en `../../control/registro-fuentes.md`.
- Confirmar con el equipo el actor de "Suspender una cuenta" (issue #38).
