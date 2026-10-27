---
seccion: "2.2.3"
titulo: "Gestión de Configuración del Software: Método de gestión de versionado durante todo el proyecto"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-10-27
---

# 2.2.3 Gestión de Configuración del Software: Método de gestión de versionado durante todo el proyecto

El código, la configuración, el esquema de base de datos y la documentación se versionan con Git en un único repositorio, [ISI-ProyectoFinal-2026/Grupo1](https://github.com/ISI-ProyectoFinal-2026/Grupo1) ([ADR-0001](../adr/0001-monorepo-y-dos-backends.md)). Las citas `archivo:línea` remiten a la línea donde empieza el elemento citado; los datos del repositorio remoto corresponden al 2026-10-27.

## 2.2.3.1 Gestión de versionado: software

### Ramas e integración

| Práctica | Descripción | Fuente |
|---|---|---|
| Rama personal | Cada integrante trabaja en una rama permanente `<nombre>/features`, creada desde `origin/main`, que no se elimina | [ADR-0010](../adr/0010-flujo-git-ramas-personales.md), [`WORKFLOW.md:11-23`](../WORKFLOW.md) |
| Ramas cortas | Se permiten ramas por tarea para aislar un cambio; la rama personal sigue siendo la opción por defecto | [`WORKFLOW.md:106`](../WORKFLOW.md), [ADR-0010](../adr/0010-flujo-git-ramas-personales.md) |
| `main` | No se commitea directamente en `main`; todo cambio llega por pull request | [`WORKFLOW.md:104-105`](../WORKFLOW.md) |
| Pull request | Desde la rama de trabajo hacia `main`, con `Closes #XX` para cerrar el issue asociado | [`WORKFLOW.md:46-57`](../WORKFLOW.md) |
| Revisión | Otro integrante aprueba la PR y el autor la integra después de la aprobación | [`WORKFLOW.md:59-62`](../WORKFLOW.md), [ADR-0010](../adr/0010-flujo-git-ramas-personales.md) |
| Sincronización | Después de cada integración, la rama se actualiza con `git pull origin main`; ante conflictos, `rebase` o `merge` de `origin/main` | [`WORKFLOW.md:64-69`](../WORKFLOW.md), [`WORKFLOW.md:140-155`](../WORKFLOW.md) |
| Commits | Conventional Commits: `feat`, `fix`, `refactor`, `docs`, `test`, `chore` | [`WORKFLOW.md:75-84`](../WORKFLOW.md) |

Tabla 2.2.3-1. Prácticas de ramas e integración. Fuente: [`WORKFLOW.md`](../WORKFLOW.md) (versión 1.0, adoptado el 2026-08-12) y [ADR-0010](../adr/0010-flujo-git-ramas-personales.md).

Ramas del repositorio remoto: cuatro personales (`matias/features`, `dbeagus/features`, `gabriel/features`, `franco/features`) y dos cortas (`matias/feat-208-mapas`, `matias/fix-179-business-plan`). Fuente: `git branch -r`.

La configuración de protección de la rama `main` en GitHub es `No disponible`: la consulta `gh api repos/ISI-ProyectoFinal-2026/Grupo1/branches/main/protection` responde 404 con los permisos del equipo, y `gh api repos/ISI-ProyectoFinal-2026/Grupo1/rulesets` devuelve una lista vacía.

### Identificación de versiones

- Cada versión del software se identifica por el SHA del commit. El repositorio no tiene tags (`git tag` no devuelve resultados) ni releases publicados (`gh release list`).
- Los paquetes declaran `"version": "0.1.0"` ([`backend/package.json:3`](../../backend/package.json)) y `"version": "0.0.0"` ([`frontend/package.json:4`](../../frontend/package.json)).

### Dependencias, esquema y entorno

| Elemento | Cómo se versiona | Fuente |
|---|---|---|
| Dependencias de Node.js | `package-lock.json` en `backend/` y `frontend/`; CI instala con `npm ci --legacy-peer-deps` | [`ci.yml:39-41`](../../.github/workflows/ci.yml#L39-L41), [`ci.yml:80-82`](../../.github/workflows/ci.yml#L80-L82) |
| Dependencias de Python | Las 18 dependencias de `backend-ia/requirements.txt` fijadas con `==` | [`requirements.txt:1-22`](../../backend-ia/requirements.txt) |
| Esquema de base de datos | Migraciones de Prisma, aplicadas en CI con `npx prisma migrate deploy` | [ADR-0004](../adr/0004-prisma-5-orm.md), [`ci.yml:54-56`](../../.github/workflows/ci.yml#L54-L56), [1.2.4](1-2-4-modelo-de-datos.md) |
| Imagen de PostgreSQL | `docker/postgres`, construida en cada job de CI que usa base de datos | [ADR-0011](../adr/0011-imagen-docker-postgres.md), [`ci.yml:20-30`](../../.github/workflows/ci.yml#L20-L30) |
| Variables de entorno | `.env` y `.env.*` excluidos de Git; se versiona un `.env.example` por paquete | [`.gitignore:5-8`](../../.gitignore), [`backend/.env.example`](../../backend/.env.example), [`frontend/.env.example`](../../frontend/.env.example), [`backend-ia/.env.example`](../../backend-ia/.env.example) |
| Artefactos generados | Excluidos de Git: dependencias instaladas, pesos de modelos (`*.pt`, `*.pth`, `*.onnx`), reportes de cobertura y de Playwright, sitio del informe (`site/`) | [`.gitignore:10-40`](../../.gitignore) |

Tabla 2.2.3-2. Elementos de configuración del software. Fuente: archivos de la columna Fuente.

### Integración continua

| Workflow | Disparador | Qué verifica | Efecto | Fuente |
|---|---|---|---|---|
| CI | `push` y `pull_request` a `main` | Cuatro jobs: backend (typecheck, typecheck de pruebas, migraciones, Jest con cobertura), frontend (lint, typecheck, Vitest con cobertura), e2e-ui (Playwright) y backend-ia (pytest con cobertura). Node 24 y Python 3.11 | Ante una falla de e2e-ui se sube el reporte de Playwright, con retención de 7 días | [`ci.yml:3-7`](../../.github/workflows/ci.yml#L3-L7), [`ci.yml:10`](../../.github/workflows/ci.yml#L10), [`ci.yml:66`](../../.github/workflows/ci.yml#L66), [`ci.yml:96`](../../.github/workflows/ci.yml#L96), [`ci.yml:164`](../../.github/workflows/ci.yml#L164), [`ci.yml:154-162`](../../.github/workflows/ci.yml#L154-L162) |
| Snyk Security | `push` y `pull_request` a `main` | Snyk Open Source en `backend/` y `frontend/`; Snyk Code en `backend/`, `frontend/` y `backend-ia/`; `snyk monitor --all-projects`. Node 20 y Python 3.11 | Bloquea ante vulnerabilidades de dependencias de severidad crítica (`--severity-threshold=critical`). Snyk Code y `monitor` no bloquean, porque sus pasos ignoran el código de salida del comando. El resultado de Snyk Code del backend se sube a GitHub en formato SARIF | [`snyk-security.yml:3-7`](../../.github/workflows/snyk-security.yml#L3-L7), [`snyk-security.yml:24-32`](../../.github/workflows/snyk-security.yml#L24-L32), [`snyk-security.yml:46-63`](../../.github/workflows/snyk-security.yml#L46-L63), [`snyk-security.yml:65-70`](../../.github/workflows/snyk-security.yml#L65-L70) |
| Publish report | Manual (`workflow_dispatch`), con la rama, tag o SHA a publicar | Pruebas del hook del sitio y `mkdocs build --strict` | Publica el informe en GitHub Pages (ver 2.2.3.2) | [`publish-report.yml:3-9`](../../.github/workflows/publish-report.yml#L3-L9) |

Tabla 2.2.3-3. Workflows de GitHub Actions. Fuente: [`.github/workflows/`](../../.github/workflows/).

Los resultados de las verificaciones (cobertura y pruebas) se detallan en [1.3.3](1-3-3-pruebas.md).

## 2.2.3.2 Gestión de versionado: documentación

La documentación se versiona en el mismo repositorio que el código y sigue el mismo flujo de ramas y pull requests, con commits de tipo `docs` ([`WORKFLOW.md:82`](../WORKFLOW.md)). El inventario de documentos está en [1.3.1.2](1-3-1-programacion-y-documentacion.md#1312-documentación).

### Versión de cada documento

| Documento | Identificación de versión | Fuente |
|---|---|---|
| Documentos técnicos | Encabezado con versión y fecha, por ejemplo ROLES.md (versión 1.0, 2026-10-21, con historial de versiones), WORKFLOW.md (versión 1.0) y ARQUITECTURA.md (versión 1.0, 2026-08-06) | [`ROLES.md:3-4`](../equipo/ROLES.md), [`WORKFLOW.md:175-176`](../WORKFLOW.md), [`ARQUITECTURA.md:4-5`](../ARQUITECTURA.md) |
| Decisiones (ADR) | Un archivo por decisión con Estado; un ADR `Aceptada` no se edita y se reemplaza por uno nuevo | [2.2.2.4](2-2-2-comunicacion-y-decisiones.md#2224-decisiones), [`.claude/CLAUDE.md:7-8`](../../.claude/CLAUDE.md) |
| Informe final | Un archivo por grupo de secciones, con encabezado YAML que registra `estado` y fecha `actualizado`; las figuras y tablas se registran en el README del informe | [Convención de archivos](README.md#convención-de-archivos) |
| Definición del proyecto | Versión en el nombre del archivo: `PDD v1.0.docx` | [`docs/pdd/`](../pdd/PDD%20v1.0.docx) |

Tabla 2.2.3-4. Identificación de versiones de la documentación. Fuente: archivos de la columna Fuente.

### Revisión periódica

La revisión periódica compara la documentación con el código y registra las decisiones que falten como ADR.

1. Al iniciar cada sesión de Claude Code (`startup` o `resume`) se ejecuta el hook [`docs-review-check.mjs`](../../.claude/hooks/docs-review-check.mjs), registrado en [`.claude/settings.json:3-9`](../../.claude/settings.json).
2. El hook lee [`docs/.docs-review.json`](../.docs-review.json): fecha de la última revisión (`lastReview`), commit revisado (`lastCommit`) e intervalo en días (`intervalDays`, 14 por defecto) ([`docs-review-check.mjs:12-17`](../../.claude/hooks/docs-review-check.mjs)).
3. Si pasaron `intervalDays` días o más, o no hay registro, avisa que la revisión está vencida y pide ejecutar el procedimiento `docs-review` ([`docs-review-check.mjs:23-37`](../../.claude/hooks/docs-review-check.mjs)). Un error del hook nunca bloquea el inicio de la sesión ([`docs-review-check.mjs:39-42`](../../.claude/hooks/docs-review-check.mjs)).
4. El procedimiento revisa los cambios desde `lastCommit`, actualiza lo descriptivo y verificable, pregunta al equipo el motivo de cada decisión no registrada, crea el ADR, actualiza el índice y registra la fecha y el SHA de la revisión. No commitea sin autorización ([`SKILL.md`](../../.claude/skills/docs-review/SKILL.md), pasos 1 a 9).

Estado al 2026-10-27: última revisión el 2026-10-21 sobre el commit `8ff5c26`, con intervalo de 14 días ([`docs/.docs-review.json`](../.docs-review.json)). La próxima vence el 2026-11-04.

### Sitio web del informe

El informe y los ADR se publican como sitio web con Material for MkDocs en GitHub Pages. La decisión está registrada en [ADR-0020](../adr/0020-sitio-web-del-informe.md), en Estado `Pendiente`.

- **Fuente única.** El sitio se genera desde el Markdown del repositorio; solo se publican `index.md`, `informe/` y `adr/` ([`mkdocs.yml:13-19`](../../mkdocs.yml)).
- **Publicación a pedido.** El workflow `Publish report` se ejecuta manualmente con la rama, tag o SHA a publicar ([`publish-report.yml:3-9`](../../.github/workflows/publish-report.yml#L3-L9)). Corre las pruebas del hook del sitio ([`publish-report.yml:39-40`](../../.github/workflows/publish-report.yml#L39-L40)) y construye con `mkdocs build --strict`, de modo que los enlaces al código apunten al commit publicado ([`publish-report.yml:45-47`](../../.github/workflows/publish-report.yml#L45-L47)). Después despliega en GitHub Pages ([`publish-report.yml:54-68`](../../.github/workflows/publish-report.yml#L54-L68)).
- **Control de cambios.** El build estricto falla si un archivo del informe no tiene entrada en `nav` o si un enlace no resuelve ([`mkdocs.yml:80-89`](../../mkdocs.yml)).
- **Estado.** GitHub Pages está habilitado con publicación por workflow en <https://isi-proyectofinal-2026.github.io/Grupo1/> (`gh api repos/ISI-ProyectoFinal-2026/Grupo1/pages`). La única ejecución registrada terminó con éxito el 2026-10-27, lanzada desde `main` ([run 40575975937](https://github.com/ISI-ProyectoFinal-2026/Grupo1/actions/runs/40575975937)).
