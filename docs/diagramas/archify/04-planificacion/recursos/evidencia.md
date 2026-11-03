# Evidencia — Recursos del proyecto

| Dato | Valor |
| --- | --- |
| Diagrama | `recursos.html` (fuente `candidate.json`) |
| Tipo Archify | `tree` |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado: `validate`, `deliver`, `check`, `browser-check` (`recursos.finalize.json`) |
| Exportaciones | `exportaciones/`: PNG 1440×900 y 2048×1320, claro y oscuro, y hoja de contacto (`visual-check`). SVG, PNG completo y WebM desde el menú Exportar del HTML |
| Sección del informe | 2.3.1 Diagrama de recursos; 2.3.3 Costos desagregados por recursos (solo identificación; costos no disponibles) |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `docs/equipo/ROLES.md:13-18` | Equipo de desarrollo |
| `tools/informe-docx/informe_docx.py:216` | Docentes de la cátedra |
| `docs/WORKFLOW.md:44-62`; `.github/workflows/*.yml` | GitHub y GitHub Actions |
| `docs/informe/1-3-1-programacion-y-documentacion.md:16-21` | Software de desarrollo |
| `docs/adr/0003-postgresql-postgis-pgvector.md`; `docs/adr/0011-imagen-docker-postgres.md` | Base de datos |
| `docs/adr/0021-modelo-embeddings-dinov2.md:14` | Inferencia en CPU sin GPU |
| `docs/adr/0008-cloudflare-r2-urls-prefirmadas.md:12-13`; `docs/adr/0009-mapas-leaflet-osm-nominatim-postgis.md:8-13` | Servicios externos y criterio de costo |
| `openspec/changes/informe-final/interviews.md:217` | "criterio de costo cero" |
| `docs/adr/0024-modelo-monetizacion.md:8` | Proveedor de pago simulado |
| `docs/ARQUITECTURA.md:112`; `README.md:158-163` | Hosting sin definir |
| `docs/informe/1-2-2-modelo-funcional.md:407` | Tarea #5 "estimación de costos" (Sprint 0, cerrada) |

## Criterios aplicados

- No se indican cantidades, presupuestos, costos ni horas: no figuran en el repositorio.
- Los recursos materiales y financieros se muestran como categorías con su estado "No disponible".
- Revisión visual: se inspeccionó la captura clara de 2048×1320.

## Pendientes y contradicciones

- Equipamiento, conectividad e instalaciones del equipo.
- Dedicación horaria por integrante.
- Costos mensuales por recurso (2.3.3) y resultado de la tarea #5.
- Proveedor de hosting de producción: `README.md` remite a `docs/DEPLOYMENT.md`, inexistente.
- `docs/ARQUITECTURA.md:85` y `:106` mencionan Redis; la propuesta del informe (`proposal.md`) declara que el sistema no usa Redis.
