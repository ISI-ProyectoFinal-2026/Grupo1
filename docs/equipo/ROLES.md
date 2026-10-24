# Roles del equipo — Grupo 1 (Patitas)

**Versión:** 1.0
**Fecha:** 2026-10-21
**Repositorio:** [ISI-ProyectoFinal-2026/Grupo1](https://github.com/ISI-ProyectoFinal-2026/Grupo1)

Este documento define el rol asignado a cada integrante y lo respalda con contribuciones verificables en el repositorio.

---

## 1. Resumen

| Integrante | Usuario GitHub | Rol asignado |
|---|---|---|
| Matías Alvarado | [@matiasalvarado5](https://github.com/matiasalvarado5) | Project Manager · Desarrollador · QA |
| Agustín Díaz | [@dbeagus](https://github.com/dbeagus) | Desarrollador Backend · Backend IA · QA |
| Gabriel Valdivieso | [@ValdiviesoGabriel](https://github.com/ValdiviesoGabriel) | Desarrollador Backend · Frontend |
| Franco Marín | [@francomarin](https://github.com/francomarin) | Desarrollador Backend · Frontend · Testing · QA · Seguridad |

---

## 2. Detalle por integrante

### Matías Alvarado — Project Manager · Desarrollador · QA

**Gestión del proyecto**
- Creación y mantenimiento del backlog: 114 de los 118 issues del repositorio.
- Revisión de código: revisor en 36 de las 41 PRs del resto del equipo.
- Plantillas de issues (user story, tarea técnica, bug, spike) y de pull request.
- Documento de definición del proyecto: `docs/pdd/PDD v1.0.docx`.
- Flujo de trabajo con ramas personales: [#52](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/52).

**Desarrollo**
- CRUD de reportes con PostGIS: [#52](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/52).
- Cierre de reporte por el autor: [#59](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/59).
- Seguridad y resiliencia (CORS, rate limiting, retry, autenticación interna con Backend IA): [#109](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/109).
- Roles, autorización y moderación de flags: [#193](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/193).
- Verificación de email y recuperación de contraseña: [#204](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/204).
- Autenticación en dos pasos (2FA): [#205](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/205).
- CI, análisis con Snyk y documentación de GitHub Actions (`docs/githubactions/`).

**QA**
- QA de integración del chat en tiempo real: [#160](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/160) (`docs/QA_CHAT_REALTIME.md`).
- Tests e2e de verificación de email y 2FA.

### Agustín Díaz — Backend · Backend IA · QA

**Backend**
- Almacenamiento de imágenes en Cloudflare R2: [#54](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/54).
- Geolocalización: [#115](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/115).
- Comercios (modelo, endpoints, estadísticas): [#116](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/116).
- Chat en tiempo real con Socket.IO: [#117](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/117), [#143](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/143).
- Hardening del backend (helmet, rate limit, health checks): [#201](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/201).

**Backend IA**
- Generación y comparación de embeddings para el matching por similitud: [#56](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/56).
- Detección automática de publicaciones que no corresponden: [#58](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/58).
- POC de control de similitud: `docs/pocs/poc_similitudes.md`.

**QA**
- Tests end-to-end del backend (supertest) y del frontend (Playwright), con job de CI: [#197](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/197).
- Revisor de las PRs del Project Manager (16 PRs).

### Gabriel Valdivieso — Backend · Frontend

**Backend**
- Esquema inicial de la base de datos: [#47](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/47).
- Registro y login de usuarios: [#60](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/60).
- Corrección del cálculo de similitud (distancia coseno) y reencolado de reportes pendientes: [#156](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/156).
- Cierre del endpoint de embeddings del Backend IA: [#158](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/158).
- Estadísticas reales del dashboard de comercios: [#165](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/165).
- Detección de animales en imágenes de reportes y moderación: [#195](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/195).

**Frontend**
- Setup inicial (React + Vite + TypeScript + Tailwind + Router): [#102](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/102).
- Componentes UI compartidos: [#129](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/129).
- Integración de autenticación y reportes con el backend: [#148](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/148).
- Panel de moderación: [#195](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/195).
- POC de APIs de mapas: `docs/pocs/poc_mapas`.

### Franco Marín — Backend · Frontend · Testing · QA · Seguridad

**Backend**
- Scaffold de Express y CRUD de mascotas: [#48](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/48).
- Estados y filtrado del feed de reportes: [#53](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/53), [#55](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/55).
- Middleware de autenticación JWT: [#114](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/114).
- Notificaciones y disparo de matches: [#145](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/145).

**Frontend**
- UI de chat en tiempo real: [#157](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/157).
- Notificaciones en el frontend: [#161](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/161).

**Testing y QA**
- Configuración de Vitest y Testing Library: [#161](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/161).
- Cobertura de tests unitarios superior al 70%: [#194](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/194).
- Tests de chat, reportes y servicios de backend: [#199](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/199).
- Reporte de QA del CRUD de mascotas: `docs/QA_PETS_CRUD.md`.

**Seguridad**
- Análisis de vulnerabilidades, corrección de críticas y pipeline de Snyk bloqueante: [#207](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/207) (en revisión).
- POC de moderación automática de imágenes: `docs/pocs/poc_moderacion`.

---

## 3. Metodología de verificación

- Fuente: historial de commits de todas las ramas, pull requests mergeadas e issues del repositorio.
- Corte: commit `8ff5c26` (2026-10-21).
- Los roles fueron definidos por el Project Manager; las contribuciones listadas son evidencia de su ejercicio.

---

## 4. Historial de versiones

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-10-21 | Definición inicial de roles y contribuciones verificadas. |
