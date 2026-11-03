# Evidencia — Estructura del equipo

| Dato | Valor |
| --- | --- |
| Diagrama | `estructura-equipo.html` (fuente `candidate.json`) |
| Tipo Archify | `tree` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`estructura-equipo.finalize.json`) |
| Exportaciones | `exportaciones/`: PNG 1440×900 y 2048×1320, claro y oscuro, y hoja de contacto (`visual-check`). SVG, PNG completo y WebM desde el menú Exportar del HTML |
| Sección del informe | 2.2.1 Equipo de trabajo (2.2.1.1 Estructura del equipo; 2.2.1.3 Asignaciones de puestos) |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `docs/equipo/ROLES.md:13-18` | Integrantes y rol asignado |
| `docs/equipo/ROLES.md:24-101` | Áreas de responsabilidad con contribuciones verificadas |
| `docs/equipo/ROLES.md:108-109` | Corte de la verificación; roles definidos por el PM |
| `tools/informe-docx/informe_docx.py:216`; `docs/GENERAR_INFORME_DOCX.md:50` | Docentes de la cátedra |
| `openspec/changes/informe-final/proposal.md:7`, `:76`; `docs/informe/README.md:3` | Revisión prevista el 2026-11-04; el PM responde las entrevistas de ADR |

## Criterios aplicados

- Las líneas del árbol representan pertenencia. Ningún documento establece una relación de reporte formal entre integrantes; por eso los cuatro integrantes figuran al mismo nivel y la coordinación del PM se expresa mediante sus responsabilidades verificadas.
- No se agregaron puestos, horas ni autoridades no documentadas.
- Revisión visual: se inspeccionó la captura clara de 2048×1320.

## Pendientes y contradicciones

- Descripción y análisis de puestos (2.2.1.2): no disponible.
- `ROLES.md:108` indica "commit `8ff5c26` (2026-10-21)"; `git log` registra ese commit el 2026-10-14.
- El PDD v1.0 nombra a "Diaz Bellomo Emiliano Agustín"; `ROLES.md` usa "Agustín Díaz".
- `ROLES.md:29` atribuye al PM las plantillas de issues y de PR; esas plantillas se eliminaron del repositorio en el commit `80bc657` (2026-08-06).
