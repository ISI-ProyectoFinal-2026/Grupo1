---
seccion: "1.2.1"
titulo: "Objetivos y alcances definitivos del nuevo sistema"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-10-27
---

# 1.2.1 Objetivos y alcances definitivos del nuevo sistema

Esta sección contrasta los objetivos y el alcance del documento de definición del proyecto ([`PDD v1.0.docx`](../pdd/PDD%20v1.0.docx), secciones "Objetivo Principal", "Objetivos Específicos" y "Alcance") con lo que el código implementa hoy.

- **Veredictos.** *Implementado*: el código cumple el ítem. *Parcial*: cumple una parte y se indica cuál falta. *Fuera de alcance*: no hay código y el equipo lo excluyó del MVP o lo dejó en un issue abierto.
- **Citas.** Las rutas son relativas a la raíz del repositorio; `archivo:línea` remite a la línea donde empieza el elemento citado. El detalle de cada módulo está en [1.2.2.2 Historias de Usuario](1-2-2-2-historias-y-flujos.md).

## Objetivos

| Objetivo del PDD | Veredicto | Evidencia |
|---|---|---|
| **Principal.** Plataforma web integral para gestionar y optimizar la búsqueda de mascotas perdidas, con geolocalización, inteligencia artificial y participación comunitaria | Parcial | Reportes, matching por IA y mapa implementados (tabla siguiente). La participación comunitaria se limita al chat y a las denuncias. El aumento de eficiencia en la recuperación no se midió: No disponible |
| Centralizar y estructurar la información de casos de mascotas perdidas y encontradas | Implementado | `backend/prisma/schema.prisma:145`, `backend/src/services/reports.service.ts:148` |
| Matching automático entre reportes de pérdida y avistamientos | Implementado | `backend-ia/app/services/matching_service.py:58`; parámetros provisionales ([#217](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/217)) |
| Facilitar la comunicación entre dueños, voluntarios y rescatistas | Implementado | Chat entre usuarios (`backend/src/sockets/chat.socket.ts:83`); no existe un perfil específico de rescatista |
| Crear una comunidad activa y comprometida con el bienestar animal | Parcial | Denuncias (`backend/src/services/report-flags.service.ts:16`); sin gamificación (decisión del equipo, ver Desvíos) |
| Validar un modelo de negocio basado en suscripciones de comercios | Fuera de alcance | Fuera del MVP; diseño pendiente en [#30](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/30). Todo comercio nace en el plan `FREE` (`backend/src/services/businesses.service.ts:38-43`) |

Tabla 1.2.1-1. Objetivos del PDD contrastados con el código. Fuente: PDD v1.0 y archivos de la columna Evidencia.

## 1.2.1.1 Alcances Definitivos

### Alcance incluido en el PDD

| Ítem del PDD | Veredicto | Evidencia |
|---|---|---|
| Gestión de mascotas y publicaciones (CRUD completo) | Parcial | Reportes con alta, detalle, feed y cierre (`backend/src/services/reports.service.ts:148`, `:263`). Mascotas y edición o eliminación de reportes existen solo en la API (`backend/src/routes/pets.routes.ts:7-11`, `backend/src/routes/reports.routes.ts:41-43`); falta la interfaz ([#225](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/225)) |
| Motor de reconocimiento y matching de imágenes | Implementado | YOLOv8n y OpenCLIP (`backend-ia/app/ml/pipeline.py:15-17`, `:85`), búsqueda de coincidencias (`backend-ia/app/services/matching_service.py:58`) |
| Sistema de geolocalización y mapas interactivos | Parcial | Mapa de reportes (`frontend/src/components/reports/MapView.tsx:40-65`). La búsqueda por radio existe solo en la API (`backend/src/services/geo.service.ts:11`); no se elige la ubicación en el mapa ([#208](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/208)) ni se diferencian los marcadores ([#209](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/209)) |
| Moderación automática de publicaciones | Implementado | Detección de animal en la imagen (`backend-ia/app/ml/pipeline.py:73`, `backend/src/services/matching.service.ts:149`); no hay vía manual para los reportes que quedan pendientes |
| Generador automático de flyers | Implementado | `backend/src/services/flyer.service.ts:247`; genera PNG y no PDF ([#67](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/67)) y no incluye un dato de contacto ([#25](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/25)) |
| Sistema de comunicación interna (chat) | Implementado | `backend/src/sockets/chat.socket.ts:83`, imágenes en el chat (`frontend/src/components/chat/ChatWindow.tsx:117`) |
| Sistema de notificaciones | Parcial | Solo dentro de la aplicación (`backend/src/services/notifications.service.ts:58`, `:151`, `:189`); sin aviso de nuevos reportes por radio ni email o push ([#32](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/32)), sin preferencias ([#226](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/226)) |
| Módulo de gamificación | Fuera de alcance | Decisión del equipo: fuera del MVP. Sin código |
| Dashboard de comercios | Parcial | Panel con datos del comercio y métricas de visitas y contactos (`frontend/src/pages/business/BusinessDashboardPage.tsx`, `backend/src/services/businesses.service.ts:157`); sin suscripción ni campañas |
| Sistema de publicidad segmentada | Fuera de alcance | Fuera del MVP; diseño pendiente en [#30](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/30). Sin código |

Tabla 1.2.1-2. Alcance incluido en el PDD contrastado con el código. Fuente: PDD v1.0 y archivos de la columna Evidencia.

### Alcance excluido en el PDD

| Ítem del PDD | Veredicto | Evidencia |
|---|---|---|
| Aplicación móvil nativa (iOS/Android) | Fuera de alcance | El frontend es una SPA web (`frontend/src/router.tsx`); el repositorio no contiene un proyecto móvil |
| Integración con entidades gubernamentales o servicios de vigilancia | Fuera de alcance | Sin código |
| Servicios de rescate o transporte de animales | Fuera de alcance | Sin código |
| Acuerdos de asociación con organizaciones externas | Fuera de alcance | Sin código |

Tabla 1.2.1-3. Alcance excluido en el PDD. Fuente: PDD v1.0 y `git ls-files`.

### Desvíos respecto del PDD

| Ítem del PDD | Situación actual | Evidencia |
|---|---|---|
| Rol `comercio` | No existe como rol. El comercio es un perfil `Business` vinculado uno a uno con un usuario, con sus propios datos (CUIT, categoría, plan, vencimiento del plan) y sus métricas de visitas y contactos. La segmentación de clientes que motivó el perfil depende de [#30](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/30) ([ADR-0019](../adr/0019-comercio-perfil-no-rol.md)) | `backend/prisma/schema.prisma:18-24`, `:312-321`, `:330-333` |
| Gamificación (puntos, canje en comercios, leaderboards, badges) | Fuera de alcance (decisión del equipo: fuera del MVP) | Sin código ni issue |
| Planes pagos y suscripción mensual o anual | Fuera del MVP; diseño pendiente en [#30](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/30). Se conservan el enum de planes y el vencimiento del plan, sin uso: todo comercio nace `FREE` y la API no permite cambiar el plan | `backend/prisma/schema.prisma:304-310`, `:321`; `backend/src/services/businesses.service.ts:38-43`; `backend/src/validators/businesses.validator.ts:4-8` |
| Publicidad segmentada por ubicación | Fuera del MVP; diseño pendiente en [#30](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/30). La interfaz ya muestra "Solo el plan Premium permite publicar anuncios."; la decisión sobre ese texto es un entregable de #30 | `frontend/src/pages/business/BusinessDashboardPage.tsx:241`, `frontend/src/pages/business/BusinessRegisterPage.tsx:149` |
| Suspensión de cuentas [SHOULD] | No implementada ([#38](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/38), abierto) | Sin código |
| WhatsApp: "continuar por WhatsApp u otros canales externos" | Implementado (vía chat interno, intercambio voluntario de contacto). No hay integración con WhatsApp: el chat acepta texto libre, sin filtro de teléfonos, y las partes pueden intercambiar su contacto si lo desean. Un botón de WhatsApp con un teléfono guardado queda fuera del MVP; el campo `phone` del usuario existe, pero ninguna ruta lo escribe | `backend/src/validators/chats.validator.ts:15`, `backend/src/validators/chat-socket.validator.ts:15`, `backend/prisma/schema.prisma:31` |
| WhatsApp: compartir el flyer en redes (WhatsApp, Instagram, Facebook) | Parcial. Se comparte con el menú del sistema operativo o se copia el enlace; no hay un botón por red social ([#26](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/26)) | `frontend/src/pages/reports/ReportDetailPage.tsx:75-85` |

Tabla 1.2.1-4. Desvíos del alcance respecto del PDD. Fuente: PDD v1.0, issues y archivos de la columna Evidencia.
