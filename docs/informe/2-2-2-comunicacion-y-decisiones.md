---
seccion: "2.2.2"
titulo: "Métodos de comunicación formal, control de avance, retroalimentación, decisiones"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-10-27
---

# 2.2.2 Métodos de comunicación formal, control de avance, retroalimentación, decisiones

## 2.2.2.1 Métodos de comunicación formal

Pendiente (Fase B)

## 2.2.2.2 Control de avance

Pendiente (Fase B)

## 2.2.2.3 Retroalimentación

Pendiente (Fase B)

## 2.2.2.4 Decisiones

### Cómo se registran

Cada decisión de arquitectura o de tecnología se registra como un ADR (registro de decisión de arquitectura) en [`docs/adr/`](../adr/README.md). La regla está en las instrucciones del proyecto ([`.claude/CLAUDE.md`](../../.claude/CLAUDE.md)) y el procedimiento, en el [índice de ADR](../adr/README.md).

- **Formato.** Cada ADR sigue la [plantilla](../adr/0000-plantilla.md): Estado, Responsables, Decisión, Motivo, Alternativas, Consecuencias y Referencias.
- **Motivo.** Lo aporta el equipo y no se infiere. Si no se conoce, el ADR dice "Pendiente de entrevista" y queda en Estado `Pendiente` ([plantilla](../adr/0000-plantilla.md)).
- **Estados.** `Aceptada`, `Pendiente` o `Reemplazada por ADR-XXXX`.
- **Cambios.** Un ADR `Aceptada` no se edita. Si la decisión cambia, se crea un ADR nuevo que enlaza al anterior, y en el anterior solo cambia el Estado ([índice](../adr/README.md), "Cómo usarlo").
- **Índice.** Cada ADR nuevo agrega su fila al índice en la misma PR. La columna C-ID vincula el ADR con su candidato de decisión (C01-C17 corresponden a ADR-0001 a ADR-0017 y CX01 a ADR-0018).
- **Decisiones de IA.** Un ADR sobre modelos, umbral o moderación enlaza en Referencias un resultado de `backend-ia/benchmarks/results/` y el comando que lo reproduce ([plantilla](../adr/0000-plantilla.md)).
- **Revisión periódica.** El procedimiento `docs-review` busca cambios que impliquen una decisión no registrada y le pregunta el motivo al equipo, de a una pregunta por vez, antes de crear el ADR ([`SKILL.md`](../../.claude/skills/docs-review/SKILL.md), pasos 5 a 7). Su ejecución se describe en [2.2.3.2](2-2-3-gestion-de-configuracion.md#2232-gestión-de-versionado-documentación).

### Decisiones registradas

| ADR | Título | Estado | Responsables |
|---|---|---|---|
| [ADR-0001](../adr/0001-monorepo-y-dos-backends.md) | Monorepo y separación en dos backends | Aceptada | Matías Alvarado |
| [ADR-0002](../adr/0002-express-5-typescript-zod.md) | Backend con Express 5, TypeScript y Zod en capas | Aceptada | Franco Marín |
| [ADR-0003](../adr/0003-postgresql-postgis-pgvector.md) | Una sola base de datos, PostgreSQL 16 con PostGIS y pgvector | Aceptada | Gabriel Valdivieso |
| [ADR-0004](../adr/0004-prisma-5-orm.md) | Prisma 5 como ORM y única fuente de migraciones | Aceptada | Gabriel Valdivieso |
| [ADR-0005](../adr/0005-fastapi-servicio-ia.md) | Servicio de IA con FastAPI | Aceptada | Agustín Díaz; Matías Alvarado |
| [ADR-0006](../adr/0006-stack-frontend.md) | Stack del frontend con React 19, Vite, TypeScript, Tailwind 3 y React Router 6 | Aceptada | Gabriel Valdivieso |
| [ADR-0007](../adr/0007-estado-y-datos-frontend.md) | Estado y datos en el frontend con TanStack Query, zustand y Axios | Aceptada | Gabriel Valdivieso; Agustín Díaz |
| [ADR-0008](../adr/0008-cloudflare-r2-urls-prefirmadas.md) | Cloudflare R2 con subida directa mediante URLs prefirmadas | Aceptada | Agustín Díaz |
| [ADR-0009](../adr/0009-mapas-leaflet-osm-nominatim-postgis.md) | Mapas con Leaflet y OpenStreetMap, Nominatim y PostGIS | Aceptada | Gabriel Valdivieso; Agustín Díaz; Matías Alvarado |
| [ADR-0010](../adr/0010-flujo-git-ramas-personales.md) | Flujo de trabajo con Git, ramas personales y revisión obligatoria | Aceptada | Matías Alvarado |
| [ADR-0011](../adr/0011-imagen-docker-postgres.md) | Imagen Docker de PostgreSQL con base oficial y PGDG | Aceptada | Gabriel Valdivieso |
| [ADR-0013](../adr/0013-dimension-embedding-512.md) | Dimensión del embedding de 512 | Aceptada | Agustín Díaz; Matías Alvarado; Gabriel Valdivieso |
| [ADR-0014](../adr/0014-parametros-matching.md) | Parámetros del matching | Pendiente | Agustín Díaz; Gabriel Valdivieso; Matías Alvarado |
| [ADR-0016](../adr/0016-moderacion-hibrida.md) | Moderación híbrida con filtro automático por IA y denuncias de usuarios | Aceptada | Franco Marín; Agustín Díaz; Matías Alvarado; Gabriel Valdivieso |
| [ADR-0017](../adr/0017-flyers-canvas.md) | Flyers con plantilla fija dibujada con canvas | Aceptada | Matías Alvarado; Agustín Díaz |
| [ADR-0018](../adr/0018-criterio-evolucion-tecnologica.md) | Criterio de evolución tecnológica | Aceptada | Equipo (Matías Alvarado, PM) |
| [ADR-0019](../adr/0019-comercio-perfil-no-rol.md) | El comercio es un perfil del usuario y no un rol | Aceptada | Agustín Díaz; Matías Alvarado |
| [ADR-0020](../adr/0020-sitio-web-del-informe.md) | Sitio web del informe con Material for MkDocs en GitHub Pages | Pendiente | Matías Alvarado |

Tabla 2.2.2-1. Decisiones registradas y su estado. Fuente: [índice de ADR](../adr/README.md); estado de cada archivo con `rg -n "Estado:" docs/adr`.

Resumen: 18 ADR registrados, 16 en Estado `Aceptada` y 2 en `Pendiente`; ninguno fue reemplazado.

- ADR-0014 pasa a `Aceptada` cuando enlace el resultado de calibración del umbral en `backend-ia/benchmarks/results/` ([índice](../adr/README.md), "Pendientes").
- Las decisiones C12 (pipeline de IA para matching) y C15 (moderación de imágenes) todavía no tienen archivo; se escriben con los resultados del benchmark ([índice](../adr/README.md), "Pendientes"). Sus números, ADR-0012 y ADR-0015, quedan reservados por la regla de numeración.
