# Registro de decisiones de arquitectura (ADR)

Cada decisión de arquitectura o tecnología del proyecto tiene un ADR corto en esta carpeta. El motivo lo aporta el equipo; no se infiere.

## Cómo usarlo

1. Copiar [`0000-plantilla.md`](0000-plantilla.md) como `NNNN-slug.md` con el siguiente número libre.
2. Completar los campos con el motivo dado por el equipo y agregar una fila al índice, en la misma PR.
3. Un ADR `Aceptada` no se edita. Si la decisión cambia, crear un ADR nuevo que enlace al anterior; el anterior solo cambia su Estado a `Reemplazada por ADR-XXXX`.

## Numeración

- C01-C17 corresponden a ADR-0001 a ADR-0017, y CX01 (criterio de evolución tecnológica) a ADR-0018.
- Las decisiones C18 en adelante se numeran a partir de ADR-0019, en orden.
- La columna C-ID vincula cada ADR con su candidato de decisión.

## Índice

| ADR | Título | Estado | Responsables | C-ID | Reemplaza / Reemplazada por |
|---|---|---|---|---|---|
| [ADR-0001](0001-monorepo-y-dos-backends.md) | Monorepo y separación en dos backends | Aceptada | Matías Alvarado | C01 | — |
| [ADR-0002](0002-express-5-typescript-zod.md) | Backend con Express 5, TypeScript y Zod en capas | Aceptada | Franco Marín | C02 | — |
| [ADR-0003](0003-postgresql-postgis-pgvector.md) | Una sola base de datos, PostgreSQL 16 con PostGIS y pgvector | Aceptada | Gabriel Valdivieso | C03 | — |
| [ADR-0004](0004-prisma-5-orm.md) | Prisma 5 como ORM y única fuente de migraciones | Aceptada | Gabriel Valdivieso | C04 | — |
| [ADR-0005](0005-fastapi-servicio-ia.md) | Servicio de IA con FastAPI | Aceptada | Agustín Díaz; Matías Alvarado | C05 | — |
| [ADR-0006](0006-stack-frontend.md) | Stack del frontend con React 19, Vite, TypeScript, Tailwind 3 y React Router 6 | Aceptada | Gabriel Valdivieso | C06 | — |
| [ADR-0007](0007-estado-y-datos-frontend.md) | Estado y datos en el frontend con TanStack Query, zustand y Axios | Aceptada | Gabriel Valdivieso; Agustín Díaz | C07 | — |
| [ADR-0008](0008-cloudflare-r2-urls-prefirmadas.md) | Cloudflare R2 con subida directa mediante URLs prefirmadas | Aceptada | Agustín Díaz | C08 | — |
| [ADR-0009](0009-mapas-leaflet-osm-nominatim-postgis.md) | Mapas con Leaflet y OpenStreetMap, Nominatim y PostGIS | Aceptada | Gabriel Valdivieso; Agustín Díaz; Matías Alvarado | C09 | — |
| [ADR-0010](0010-flujo-git-ramas-personales.md) | Flujo de trabajo con Git, ramas personales y revisión obligatoria | Aceptada | Matías Alvarado | C10 | — |
| [ADR-0011](0011-imagen-docker-postgres.md) | Imagen Docker de PostgreSQL con base oficial y PGDG | Aceptada | Gabriel Valdivieso | C11 | — |
| [ADR-0013](0013-dimension-embedding-512.md) | Dimensión del embedding de 512 | Aceptada | Agustín Díaz; Matías Alvarado; Gabriel Valdivieso | C13 | — |
| [ADR-0014](0014-parametros-matching.md) | Parámetros del matching | Pendiente | Agustín Díaz; Gabriel Valdivieso; Matías Alvarado | C14 | — |
| [ADR-0016](0016-moderacion-hibrida.md) | Moderación híbrida con filtro automático por IA y denuncias de usuarios | Aceptada | Franco Marín; Agustín Díaz; Matías Alvarado; Gabriel Valdivieso | C16 | — |
| [ADR-0017](0017-flyers-canvas.md) | Flyers con plantilla fija dibujada con canvas | Aceptada | Matías Alvarado; Agustín Díaz | C17 | — |
| [ADR-0018](0018-criterio-evolucion-tecnologica.md) | Criterio de evolución tecnológica | Aceptada | Equipo (Matías Alvarado, PM) | CX01 | — |
| [ADR-0019](0019-comercio-perfil-no-rol.md) | El comercio es un perfil del usuario y no un rol | Aceptada | Agustín Díaz; Matías Alvarado | C28 (parte) | — |

## Pendientes

- C12 (pipeline de IA para matching) y C15 (moderación de imágenes): sin archivo todavía; se escriben con los resultados del benchmark de `backend-ia/benchmarks/`.
- ADR-0014 (parámetros del matching): el texto está aprobado, pero pasa a `Aceptada` cuando enlace el resultado de calibración del umbral en `backend-ia/benchmarks/results/` y `backend-ia/benchmarks/README.md`.
