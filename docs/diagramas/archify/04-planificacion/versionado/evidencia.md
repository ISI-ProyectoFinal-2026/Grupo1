# Evidencia — Gestión de versionado

| Dato | Valor |
| --- | --- |
| Diagrama | `versionado.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`versionado.finalize.json`) |
| Exportaciones | `exportaciones/`: PNG 1440×900 y 2048×1320, claro y oscuro, y hoja de contacto (`visual-check`). SVG, PNG completo y WebM desde el menú Exportar del HTML |
| Sección del informe | 2.2.3 Gestión de configuración del software (2.2.3.1 software; 2.2.3.2 documentación) |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `docs/WORKFLOW.md:11-86` | Ramas, PR, revisión, merge, sincronización y Conventional Commits |
| `docs/adr/0010-flujo-git-ramas-personales.md:8` | Ramas personales permanentes y revisión obligatoria |
| `.github/workflows/ci.yml:3-7`; `.github/workflows/snyk-security.yml:3-7` | CI y Snyk en push y PR a `main` |
| `.github/workflows/publish-report.yml:3-8` | Publicación manual del sitio desde una rama, tag o SHA |
| `docs/adr/0020-sitio-web-del-informe.md:3`, `:15` | Markdown como única fuente con revisión por PR; ADR en estado Pendiente |
| `docs/adr/README.md:9` | Un ADR aceptado no se reescribe: se reemplaza |
| `docs/informe/README.md:3`, `:44-66` | Encabezado YAML con estado y fecha; Fase B y `.docx` |
| `docs/informe/1-3-1-programacion-y-documentacion.md:46`, `:65` | Documentación versionada con el código; `docs-review` cada 14 días |
| `docs/.docs-review.json` | Intervalo de 14 días; última revisión 2026-10-21 |
| `README.md:158-163` | Referencia a `docs/DEPLOYMENT.md`, archivo inexistente |
| `git tag`; `gh release list` | Sin tags ni releases (consulta del 2026-11-02) |

## Diferencia entre código y documentación

- Software: rama, commits convencionales, PR, revisión con CI y Snyk, merge y sincronización. No hay numeración de versiones, tags ni releases.
- Documentación: mismo circuito de PR; versión declarada manualmente en cada documento (PDD v1.0, ARQUITECTURA 1.0, ROLES 1.0, WORKFLOW 1.0), estado y fecha en el encabezado YAML del informe, reemplazo de ADR, revisión periódica y publicación manual del sitio. El `.docx` final se genera fuera del repositorio (Fase B).

## Contradicciones

- `docs/adr/README.md:9` dice que un ADR `Aceptada` no se edita; `.claude/CLAUDE.md` y el skill `documentacion` permiten editarlo para completarlo o corregirlo.
- `README.md:160` remite a `docs/DEPLOYMENT.md`, que no existe; `docs/ARQUITECTURA.md:112` lista AWS, Google Cloud y Hetzner sin decisión registrada.

## Criterios aplicados

- Leyenda de colores oculta, por el mismo motivo que en `comunicacion-decisiones`.
- Revisión visual: se inspeccionó la captura clara de 2048×1320.
