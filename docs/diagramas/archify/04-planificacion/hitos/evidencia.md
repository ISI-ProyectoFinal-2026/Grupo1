# Evidencia — Hitos del proyecto

| Dato | Valor |
| --- | --- |
| Diagrama | `hitos.html` (fuente `candidate.json`) |
| Tipo Archify | `timeline` (eventos observados) |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`hitos.finalize.json`) |
| Exportaciones | `exportaciones/`: PNG 1440×900 y 2048×1320, claro y oscuro, y hoja de contacto (`visual-check`). SVG, PNG completo y WebM desde el menú Exportar del HTML |
| Sección del informe | 2.1 Actividades (2.1.1.1 Hitos) |

## Fuentes por evento

| Fecha | Evento | Estado | Fuente |
| --- | --- | --- | --- |
| 2026-05-28 | Creación del repositorio | Completado | `git log`, commit `ade2b12` |
| 2026-06-17 | Alta de milestones Sprint 0-5 y plantillas de issues | Completado | API de milestones (`created_at`); commits `306cfe2`, `c166ba5`, `d7a11e1`, `6bfe339` |
| 2026-07-21 | PDD v1.0 | Completado | `docs/pdd/PDD v1.0.docx` ("realizado ... el 21-7-2026"); commit `2f22b1b` |
| 2026-08-06 | Arquitectura v1.0 | Completado | `docs/ARQUITECTURA.md:3-5` |
| 2026-08-12 | Flujo de trabajo adoptado | Completado | `docs/WORKFLOW.md:175-176` |
| 2026-08-13 | Cierre de Sprint 0 y Sprint 1 | Completado | API de milestones (`closed_at`) |
| 2026-08-18 | Cierre de Sprint 2 | Completado | API de milestones (`closed_at`) |
| 2026-08-26 | Cierre de Sprint 3 | Completado | API de milestones (`closed_at`) |
| 2026-09-23 | Cierre de Sprint 4 y alta de Sprint 6 | Completado | API de milestones (`closed_at`, `created_at`) |
| 2026-10-21 | ROLES v1.0 y propuesta del informe final | Completado | `docs/equipo/ROLES.md:3-4`; `openspec/changes/informe-final/proposal.md:3` |
| 2026-10-26 | Benchmark DINOv2 frente a OpenCLIP | Completado | `docs/adr/0021-modelo-embeddings-dinov2.md:186` |
| 2026-10-30 | Fecha límite de Sprint 6 | En curso (abierto, vencido) | API de milestones |
| 2026-11-02 | Fecha límite de Sprint 5 | En curso (abierto) | API de milestones |
| 2026-11-03 | Cierre de la Fase A del informe | Planificado | `docs/informe/README.md:3`; `proposal.md:100` |
| 2026-11-04 | Revisión de la cátedra | Planificado | `proposal.md:7` |

## Planificación frente a ejecución (milestones)

Consulta: `gh api repos/ISI-ProyectoFinal-2026/Grupo1/milestones?state=all`, 2026-11-02.

| Milestone | Fecha límite planificada | Cierre real | Issues abiertos / cerrados |
| --- | --- | --- | --- |
| Sprint 0 - POCs | 2026-06-29 | 2026-08-13 | 0 / 6 |
| Sprint 1 - Documentación | 2026-07-03 | 2026-08-13 | 0 / 4 |
| Sprint 2 – Desarrollo Core | 2026-08-14 | 2026-08-18 | 0 / 20 |
| Sprint 3 - Features | 2026-08-26 | 2026-08-26 | 0 / 44 |
| Sprint 4 – Desarrollo + Notificaciones | 2026-09-09 | 2026-09-23 | 0 / 22 |
| Sprint 6 – Cierre de features | 2026-10-30 | Abierto | 14 / 26 |
| Sprint 5 – QA | 2026-11-02 | Abierto | 5 / 31 |

Las fechas de la API están en UTC (`T00:00:00Z`); se toman como fecha calendario.

## Criterios aplicados

- Solo se incluyen eventos con fecha exacta y fuente identificable; no hay duraciones ni fechas estimadas.
- La hora 00:00 del eje no es significativa.
- No reemplaza el diagrama Gantt del Anexo N.º 1, que no existe en el repositorio.
- Revisión visual: se inspeccionó la captura clara de 2048×1320.

## Pendientes y contradicciones

- La fecha de cierre de Sprint 0 y Sprint 1 (2026-08-13) es posterior en más de un mes a la planificada; no se documenta si refleja la finalización real del trabajo o un cierre administrativo.
- Sprint 6 se numeró después de Sprint 5 pero su fecha límite es anterior.
- Sin fechas de inicio y fin por etapa (2.1.1.2), sin fecha de la Fase B, de la generación del `.docx` ni de la entrega final.
- Las fechas de cierre de milestones no figuran en ningún archivo del repositorio; dependen de la API de GitHub.
