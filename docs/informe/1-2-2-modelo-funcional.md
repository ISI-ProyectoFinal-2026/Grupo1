---
seccion: "1.2.2"
titulo: "Modelo funcional"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-10-24
---

# 1.2.2 Modelo funcional

El modelo funcional describe qué hace el sistema y cómo lo hace. La sección 1.2.2.2 está en un archivo propio por su extensión.

## 1.2.2.1 Diagrama de casos de uso

Pendiente (slice 15).

### 1.2.2.1.1 Lista de Requerimientos

Pendiente (slice 15).

## 1.2.2.2 Historias de Usuario

Ver [1.2.2.2 Historias de Usuario](1-2-2-2-historias-y-flujos.md): visión general del funcionamiento, perfiles de usuario y, para cada módulo, historias, flujo punta a punta, reglas de negocio, comportamiento ante fallas y limitaciones. Módulos:

1. [Autenticación y seguridad de la cuenta](1-2-2-2-historias-y-flujos.md#12221-módulo-de-autenticación-y-seguridad-de-la-cuenta)
2. [Reportes de mascotas](1-2-2-2-historias-y-flujos.md#12222-módulo-de-reportes-de-mascotas-alta-detalle-feed-y-cierre)
3. [Moderación automática por IA y matching](1-2-2-2-historias-y-flujos.md#12223-módulo-de-moderación-automática-por-ia-y-matching)
4. [Notificaciones](1-2-2-2-historias-y-flujos.md#12224-módulo-de-notificaciones)
5. [Chat](1-2-2-2-historias-y-flujos.md#12225-módulo-de-chat)
6. [Flyers](1-2-2-2-historias-y-flujos.md#12226-módulo-de-flyers)
7. [Moderación comunitaria](1-2-2-2-historias-y-flujos.md#12227-módulo-de-moderación-comunitaria-denuncias)
8. [Mapa y geolocalización](1-2-2-2-historias-y-flujos.md#12228-módulo-de-mapa-y-geolocalización)
9. [Comercios](1-2-2-2-historias-y-flujos.md#12229-módulo-de-comercios)

## 1.2.2.3 Tareas

Las tareas son los issues con la etiqueta `type: task`: `gh issue list --repo ISI-ProyectoFinal-2026/Grupo1 --state all --label "type: task" --limit 200 --json number,title,state,milestone` (23 issues al 2026-10-24). Las fechas de cierre de cada milestone provienen de `gh api repos/ISI-ProyectoFinal-2026/Grupo1/milestones?state=all`.

| Milestone | Fecha límite | Tareas | Cerradas | Abiertas |
|---|---|---|---|---|
| Sprint 0 - POCs | 2026-06-29 | 2 | 2 | 0 |
| Sprint 1 - Documentación | 2026-07-03 | 0 | 0 | 0 |
| Sprint 2 – Desarrollo Core | 2026-08-14 | 2 | 2 | 0 |
| Sprint 3 - Features | 2026-08-26 | 12 | 12 | 0 |
| Sprint 4 – Desarrollo + Notificaciones | 2026-09-09 | 2 | 2 | 0 |
| Sprint 5 – QA | 2026-11-02 | 5 | 2 | 3 |
| Sprint 6 – Cierre de features | 2026-10-30 | 0 | 0 | 0 |
| **Total** | | **23** | **20** | **3** |

Tabla 1.2.2-20. Tareas por milestone. Fuente: los dos comandos `gh` de esta sección.

| Milestone | Issue | Tarea | Estado |
|---|---|---|---|
| Sprint 0 | [#5](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/5) | Consolidar decisiones técnicas, arquitectura preliminar y estimación de costos (título del issue: "[TASK]") | Cerrado |
| Sprint 0 | [#43](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/43) | Sin título ni contenido (plantilla vacía) | Cerrado |
| Sprint 2 | [#11](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/11) | Configuración de DB | Cerrado |
| Sprint 2 | [#51](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/51) | Configuración Cloudflare R2 | Cerrado |
| Sprint 3 | [#61](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/61) | Frontend: setup inicial (React + Vite + TS + Tailwind + Router) | Cerrado |
| Sprint 3 | [#62](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/62) | Frontend: cliente HTTP y tipos de la API (Axios + interceptor JWT) | Cerrado |
| Sprint 3 | [#71](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/71) | Backend: endpoints geo (`/api/geo/nearby`, `/api/geo/map`) | Cerrado |
| Sprint 3 | [#72](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/72) | Backend: endpoints de chat (`/api/chats` y mensajes) | Cerrado |
| Sprint 3 | [#73](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/73) | Backend: Socket.io en Express | Cerrado |
| Sprint 3 | [#74](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/74) | Backend: middleware JWT en rutas protegidas | Cerrado |
| Sprint 3 | [#75](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/75) | Backend: endpoints de notificaciones (`/api/notifications`) | Cerrado |
| Sprint 3 | [#76](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/76) | Backend: esquema y endpoints de comercios (`/api/businesses`) | Cerrado |
| Sprint 3 | [#111](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/111) | Frontend: tipos TypeScript base | Cerrado |
| Sprint 3 | [#112](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/112) | Frontend: componentes UI compartidos | Cerrado |
| Sprint 3 | [#113](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/113) | Frontend: ErrorBoundary, NotFound y estructura del router | Cerrado |
| Sprint 3 | [#125](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/125) | Integración: autenticación y reportes (frontend y backend) | Cerrado |
| Sprint 4 | [#126](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/126) | Integración: chat en tiempo real (Socket.io y frontend) | Cerrado |
| Sprint 4 | [#127](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/127) | Integración: procesamiento de IA (reportes, Backend IA y pgvector) | Cerrado |
| Sprint 5 | [#39](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/39) | Test end-to-end | Cerrado |
| Sprint 5 | [#40](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/40) | Tests de carga y performance | Abierto |
| Sprint 5 | [#41](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/41) | Análisis de vulnerabilidades | Abierto |
| Sprint 5 | [#42](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/42) | Tests unitarios | Cerrado |
| Sprint 5 | [#215](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/215) | Mover el JWT de `localStorage` a una cookie httpOnly | Abierto |

Tabla 1.2.2-21. Tareas por milestone. Fuente: `gh issue list --repo ISI-ProyectoFinal-2026/Grupo1 --state all --label "type: task" --limit 200 --json number,title,state,milestone`.

Sprint 1 y Sprint 6 no tienen issues con la etiqueta `type: task`.
