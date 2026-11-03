# Pendientes y limitaciones

Solo cuestiones verificables o pendientes de relevamiento.

## Pendientes de relevamiento

| ID | Pendiente | Origen |
| --- | --- | --- |
| P-01 | Identificar los dos competidores a relevar en `archify/01-relevamiento/competidor-a` y `competidor-b`; sus nombres no están definidos en esta estructura. | Estructura inicial de `docs/diagramas/` |
| P-02 | Completar `control/inventario-repositorio.md` con los componentes verificados del repositorio. | Estructura inicial |
| P-03 | Definir qué diagramas de `../indice-maestro.md` se producen, su tipo y su orden. | Estructura inicial |
| P-04 | Cobertura pendiente: pruebas de carga y rendimiento planificadas en el issue #40 (abierto), sin pruebas ni mediciones en el repositorio. | D-22 |
| P-05 | Cobertura pendiente: ninguna prueba ejecuta el backend principal y el Backend IA reales juntos; ambas suites E2E usan stub y pytest simula `_notify_match`. | D-22, D-24 |
| P-06 | Cobertura pendiente: las 2 pruebas con los pesos reales de YOLO se omiten en CI (`RUN_REAL_MODEL_TESTS`). | D-22 |
| P-07 | Cobertura pendiente: las pruebas E2E de interfaz solo corren en Chromium. | D-22 |
| P-08 | Cobertura pendiente: `tools/informe-docx/tests/` no se ejecuta en ningún workflow. | D-22 |
| P-09 | Cobertura de requerimientos: la relación requerimiento → prueba no se verificó en D-22 a D-24; los porcentajes de cobertura de código no la reemplazan. | D-22 |
| P-10 | `docs/informe/1-3-3-pruebas.md` cita la corrida 38512798771 (`8ff5c26`): 929 tests de backend, 648 de frontend, 55 de Backend IA, 8 specs y 18 tests E2E. La corrida 41448272798 (`f518b9a`) registra 1351, 935, 77, 13 specs y 23 tests, y Snyk ya ejecuta (PR #207 integrado). Actualización propuesta como Issue; no realizada. | D-22 |
| P-11 | Confirmar con el equipo el entorno de producción (hosting, dominio, terminación TLS y redirección HTTPS) y si se usan los túneles admitidos en `frontend/vite.config.ts:26`. | D-25 |
| P-12 | Confirmar el procedimiento de backup y restauración de PostgreSQL, R2 y secretos (herramienta, frecuencia, ubicación, retención, verificación). No hay evidencia en el repositorio. | D-29 |
| P-13 | Confirmar la configuración del bucket R2 (acceso público, CORS, versionado, retención) y el cifrado en reposo de la base y de R2. | D-26, D-29 |
| P-14 | Confirmar el proveedor SMTP del entorno desplegado y la custodia de `INTERNAL_API_KEY`, `JWT_SECRET` y `TWO_FACTOR_ENCRYPTION_KEY`. | D-25, D-29 |
| P-15 | Confirmar en GitHub la protección de `main` y si Dependabot está activo desde la configuración del repositorio (no existe `.github/dependabot.yml`). | D-27, D-31 |
| P-16 | Proponer Issue `[BUG]`/`[REFACTOR]`: `requireInternalKey` compara la clave con `!==` (no constante), a diferencia del Backend IA (`compare_digest`). No implementado. | D-28 |
| P-17 | Proponer Issue `[DOCS]`: el Anexo N.º 11 de `template-outline.md:212` menciona Sequelize; el proyecto usa Prisma. ADR-0021 menciona una tabla de respaldo que la migración `20261014000000` no crea. | D-29, D-30 |
| P-18 | Sin implementación, no diagramados: donaciones, ONG y adopción (sin coincidencias en `backend/src`, `schema.prisma`, `backend-ia/app`, `frontend/src/router.tsx`); asignación de moderadores (#224), suspensión de usuarios (#38), ocultamiento por acumulación (#218) y descarte de denuncia de reporte (#223). | D-09 a D-16, D-35 a D-44 |
| P-19 | Proponer Issue `[DOCS]`: `docs/informe/1-2-2-2-historias-y-flujos.md` muestra un alta de reporte sin foto que pasa a `published`; el código exige foto (`reports.validator.ts:10`) y el reporte nace `pending` (`reports.service.ts:162`). También afirma que la vista mapa no usa `GET /api/geo/map` (sí lo usa, `FeedPage.tsx:54-60`) y que `EditReportPage` y las páginas de mascotas no existen. | D-10, D-12, D-39 |
| P-20 | Proponer Issue `[DOCS]`: `docs/informe/1-2-1` afirma que no hay interfaz de mascotas ni de edición de reportes ni preferencias de notificación, y menciona OpenCLIP; el código tiene esas pantallas y rutas (`router.tsx:58`, `:68-70`) y usa DINOv2. | D-03 a D-06 |
| P-21 | Proponer Issue `[BUG]` a revisar: resolver una denuncia de reporte pasa el reporte a `rejected` sin verificar su estado actual; un anuncio `PAUSED` puede pasar a `REMOVED`. No implementado. | D-41, D-42 |
| P-22 | Diferencias entre migraciones y `schema.prisma`: índices GIST y HNSW solo en SQL; nulabilidad distinta de `pets.photo_urls` y `businesses.social_links`; el ORM del Backend IA mapea 5 de 14 columnas de `reports` y no modela `report_matches`. | D-07 |

## Limitaciones verificadas

| ID | Limitación | Verificación |
| --- | --- | --- |
| L-01 | La skill `archify` (v3.2) se instaló el 2026-11-02; se revisó por búsqueda de patrones, sin auditoría línea por línea de `bin/archify.mjs` ni de `bin/visual-check.mjs`. | Revisión de la sesión del 2026-11-02 |
| L-02 | El comando `finalize` de Archify realiza un chequeo de actualizaciones por red hacia una URL fija; se desactiva con `ARCHIFY_UPDATE_CHECK_DISABLED=1`. | `scripts/check-update.mjs` de la skill |
| L-03 | D-22 a D-24: no se ejecutaron pruebas localmente; los resultados provienen solo del log de la corrida CI 41448272798. No hay métricas de carga ni tiempos de respuesta. | `gh run view 41448272798 --log` |
| L-04 | D-22: la cantidad de vulnerabilidades de Snyk no se extrajo; solo consta la conclusión `success` de la corrida 41448272870. | `gh run view 41448272870` |
| L-05 | D-22: el resultado de las pruebas de `tools/informe-site` en `publish-report.yml` no se consultó. | `.github/workflows/publish-report.yml:40` |
| L-06 | D-22: las categorías agrupan archivos por responsabilidad principal; los conteos de 400 y 429 cuentan archivos con esas aserciones, y un archivo puede pertenecer a varias categorías. | `git ls-files`, búsqueda de patrones en `backend/tests` |
| L-07 | Los ID D-22 a D-24 se asignaron sin coordinación con la producción en paralelo de otras fases; revisar duplicados al consolidar el índice. | Sesión del 2026-11-02 |
| L-08 | D-25 a D-31: no se leyeron los valores de los archivos `.env*` (acceso denegado a `.env.example` en parte de la sesión); solo se usan nombres de variables. No se ejecutaron despliegues, migraciones ni restauraciones. | Sesión del 2026-11-02 |
| L-09 | D-26: por legibilidad se omitieron como flechas la respuesta IA → backend y la generación de flyers; constan en una tarjeta del diagrama. D-25 y D-27 conservan rutas con 3 quiebres hacia R2. | `flujo-datos.finalize.json`, `despliegue.finalize.json`, `mapa-integraciones.finalize.json` |
| L-10 | D-25 a D-31: sin revisión visual de capturas; solo chequeos automatizados de Archify. | Recibos `*.finalize.json` |
