# Evidencia — Comunicación, seguimiento y decisiones

| Dato | Valor |
| --- | --- |
| Diagrama | `comunicacion-decisiones.html` (fuente `candidate.json`) |
| Tipo Archify | `workflow` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`comunicacion-decisiones.finalize.json`) |
| Exportaciones | `exportaciones/`: PNG 1440×900 y 2048×1320, claro y oscuro, y hoja de contacto (`visual-check`). SVG, PNG completo y WebM desde el menú Exportar del HTML |
| Sección del informe | 2.2.2 Métodos de comunicación formal, control de avance, retroalimentación y decisiones |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `docs/WORKFLOW.md:11-70` | Rama personal, PR con `Closes #N`, revisión, merge por el autor, sincronización |
| `docs/adr/0010-flujo-git-ramas-personales.md:8`, `:15` | Revisión obligatoria; 36 de 41 PR revisadas por el PM |
| `docs/equipo/ROLES.md:26-29` | Backlog: 114 de 118 issues creados por el PM |
| `docs/informe/1-2-2-modelo-funcional.md:390-401` | Milestones por sprint con fecha límite |
| `.claude/PROYECTO_REGLAS.md:42-48` | Hallazgos durante la tarea: aviso y propuesta de issue clasificado |
| `openspec/changes/informe-final/proposal.md:7`, `:76`; `interviews.md:5-7` | Candidatos de decisión C01-C36 y entrevistas al PM |
| `docs/adr/README.md:5-9`, `:32` | Ciclo de vida del ADR; reemplazo de ADR-0013 por ADR-0021 |
| `openspec/changes/informe-final/template-outline.md:203` | Anexo N.º 2: minutas de reuniones (sin contenido en el repositorio) |

## Verificación por elemento

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Seguimiento por issues, PR y milestones | Verificado | `WORKFLOW.md`; API de milestones de GitHub |
| Retroalimentación en la revisión de la PR | Verificado (procedimiento) | `WORKFLOW.md:59-62` |
| Decisiones registradas como ADR tras entrevista | Verificado | `proposal.md:76`; `docs/adr/README.md` |
| Reuniones, frecuencia y minutas | No disponible | El PDD menciona "la próxima daily"; no hay registros |
| Canal formal de comunicación interna | No disponible | — |
| Devoluciones de la cátedra | No disponible | Solo consta la revisión prevista del 2026-11-04 |

## Criterios aplicados

- Los nodos del carril "Sin registro en el repositorio" no tienen relaciones: no hay evidencia de cómo se integran al flujo.
- Leyenda de colores oculta: las categorías genéricas del renderizador no describen roles de gestión.
- Revisión visual: se inspeccionó la captura clara de 2048×1320.

## Contradicciones

- `WORKFLOW.md:62` indica que el autor integra tras la aprobación; el ejemplo de `WORKFLOW.md:126` dice "Code reviewer revisa y mergea".
