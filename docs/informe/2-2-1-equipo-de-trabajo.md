---
seccion: "2.2.1"
titulo: "Equipo de trabajo"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-10-27
---

# 2.2.1 Equipo de trabajo

La fuente de esta sección es [`ROLES.md`](../equipo/ROLES.md) (versión 1.0, 2026-10-21). Ese documento asigna un rol a cada integrante y lo respalda con contribuciones verificables en el repositorio, con corte en el commit `8ff5c26` (ROLES.md, sección 3).

## 2.2.1.1 Estructura del equipo

El equipo tiene cuatro integrantes. Uno de ellos es Project Manager y además desarrolla; los otros tres combinan desarrollo, pruebas y seguridad. Los roles los definió el Project Manager, y las contribuciones listadas en ROLES.md son la evidencia de su ejercicio (ROLES.md, sección 3).

| Integrante | Usuario GitHub | Rol asignado |
|---|---|---|
| Matías Alvarado | [@matiasalvarado5](https://github.com/matiasalvarado5) | Project Manager · Desarrollador · QA |
| Agustín Díaz | [@dbeagus](https://github.com/dbeagus) | Desarrollador Backend · Backend IA · QA |
| Gabriel Valdivieso | [@ValdiviesoGabriel](https://github.com/ValdiviesoGabriel) | Desarrollador Backend · Frontend |
| Franco Marín | [@francomarin](https://github.com/francomarin) | Desarrollador Backend · Frontend · Testing · QA · Seguridad |

Tabla 2.2.1-1. Integrantes y roles asignados. Fuente: [`ROLES.md`](../equipo/ROLES.md), sección 1.

La revisión de código es cruzada: el Project Manager fue revisor en 36 de las 41 PRs del resto del equipo, y Agustín Díaz revisó 16 PRs del Project Manager (ROLES.md, sección 2). La revisión obligatoria antes de integrar a `main` está registrada en [ADR-0010](../adr/0010-flujo-git-ramas-personales.md).

## 2.2.1.2 Descripción y análisis de puestos

Cada puesto se describe con las tareas que ROLES.md registra bajo ese rol. No se agregan responsabilidades que no figuren en el repositorio.

| Puesto | Tareas registradas | Integrantes |
|---|---|---|
| Project Manager | Creación y mantenimiento del backlog (114 de los 118 issues), revisión de código, plantillas de issues y de pull request, documento de definición del proyecto (PDD v1.0) y flujo de trabajo con ramas personales | Matías Alvarado |
| Desarrollador | CRUD de reportes con PostGIS, cierre de reportes, seguridad y resiliencia, roles y moderación, verificación de email, 2FA, CI y análisis con Snyk | Matías Alvarado |
| Desarrollador Backend | Esquema de base de datos, registro, login y middleware JWT, CRUD de mascotas, feed de reportes, almacenamiento de imágenes, geolocalización, comercios, chat en tiempo real, notificaciones, cálculo de similitud, detección de animales y endurecimiento del backend | Agustín Díaz, Gabriel Valdivieso, Franco Marín |
| Backend IA | Generación y comparación de embeddings para el matching, detección de publicaciones que no corresponden y prueba de concepto de similitud | Agustín Díaz |
| Frontend | Configuración inicial, componentes compartidos, integración con el backend, panel de moderación, chat y notificaciones | Gabriel Valdivieso, Franco Marín |
| Testing y QA | Pruebas end-to-end (supertest y Playwright) con su job de CI, configuración de Vitest, cobertura unitaria, informes de QA del chat y del CRUD de mascotas | Matías Alvarado, Agustín Díaz, Franco Marín |
| Seguridad | Análisis de vulnerabilidades, corrección de las críticas y pipeline de Snyk bloqueante | Franco Marín |

Tabla 2.2.1-2. Puestos y tareas registradas. Fuente: [`ROLES.md`](../equipo/ROLES.md), sección 2.

Análisis, con base en las tablas 2.2.1-1 y 2.2.1-2:

- Todos los integrantes ocupan más de un puesto.
- El desarrollo backend lo comparten tres integrantes; Backend IA y Seguridad están a cargo de uno solo.
- Hay trabajo de seguridad también fuera del puesto de Seguridad: CORS, rate limiting y autenticación interna con el Backend IA ([#109](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/109), Matías Alvarado) y helmet, rate limit y health checks ([#201](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/201), Agustín Díaz).
- Las tareas de QA las ejercen tres de los cuatro integrantes.

## 2.2.1.3 Asignaciones de puestos

| Integrante | Puesto | Evidencia |
|---|---|---|
| Matías Alvarado | Project Manager | Flujo de trabajo con ramas personales ([#52](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/52)); PDD v1.0 ([`PDD v1.0.docx`](../pdd/PDD%20v1.0.docx)) |
| | Desarrollador | [#52](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/52), [#59](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/59), [#109](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/109), [#193](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/193), [#204](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/204), [#205](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/205); documentación de GitHub Actions ([`docs/githubactions/`](../githubactions/README.md)) |
| | QA | QA del chat en tiempo real ([#160](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/160), [`QA_CHAT_REALTIME.md`](../QA_CHAT_REALTIME.md)); pruebas e2e de verificación de email y 2FA |
| Agustín Díaz | Desarrollador Backend | [#54](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/54), [#115](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/115), [#116](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/116), [#117](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/117), [#143](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/143), [#201](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/201) |
| | Backend IA | [#56](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/56), [#58](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/58); POC de similitud ([`poc_similitudes.md`](../pocs/poc_similitudes.md)) |
| | QA | Pruebas end-to-end con job de CI ([#197](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/197)); revisión de 16 PRs del Project Manager |
| Gabriel Valdivieso | Desarrollador Backend | [#47](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/47), [#60](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/60), [#156](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/156), [#158](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/158), [#165](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/165), [#195](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/195) |
| | Frontend | [#102](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/102), [#129](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/129), [#148](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/148), [#195](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/195); POC de APIs de mapas (`docs/pocs/poc_mapas`) |
| Franco Marín | Desarrollador Backend | [#48](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/48), [#53](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/53), [#55](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/55), [#114](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/114), [#145](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/145) |
| | Frontend | [#157](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/157), [#161](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/161) |
| | Testing y QA | [#161](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/161), [#194](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/194), [#199](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/199); QA del CRUD de mascotas ([`QA_PETS_CRUD.md`](../QA_PETS_CRUD.md)) |
| | Seguridad | [#207](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/207); POC de moderación de imágenes (`docs/pocs/poc_moderacion`) |

Tabla 2.2.1-3. Asignación de puestos con su evidencia. Fuente: [`ROLES.md`](../equipo/ROLES.md), sección 2.

ROLES.md registra la PR [#207](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/207) como "en revisión" a la fecha de corte; se integró a `main` el 2026-10-27 (commit `66106fd`).
