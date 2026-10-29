---
name: docs-review
description: Revisión periódica de la documentación técnica del proyecto. Trigger: el hook SessionStart avisa que la revisión está vencida, o el usuario pide "revisar/actualizar la documentación", "docs review".
---

# Revisión periódica de documentación técnica

Objetivo: que `docs/` refleje el estado real del código y que toda decisión de arquitectura quede registrada como ADR en `docs/adr/`, con su justificación.

Alcance de la revisión: `docs/ARQUITECTURA.md` y demás documentos técnicos, `docs/adr/` (decisiones) y `docs/informe/` (fuente del informe final).

## Estado

`docs/.docs-review.json`:

```json
{ "lastReview": "YYYY-MM-DD", "lastCommit": "<sha>", "intervalDays": 14 }
```

El hook `.claude/hooks/docs-review-check.mjs` compara `lastReview` con la fecha actual al iniciar cada sesión.

## Procedimiento

1. Leer `docs/.docs-review.json` y obtener los cambios desde `lastCommit`:
   `git log --oneline <lastCommit>..HEAD` y `git diff --stat <lastCommit>..HEAD`.
2. Detectar cambios con impacto en la documentación. Prioridad:
   - Dependencias y versiones: `backend/package.json`, `frontend/package.json`, `backend-ia/requirements*.txt` / `pyproject.toml`.
   - Modelos de IA y pipeline: `backend-ia/app/ml/`.
   - Infraestructura: `docker-compose.yml`, `docker/`, `.github/workflows/`.
   - Esquema de base de datos y migraciones.
   - Endpoints y variables de entorno.
3. Contrastar cada cambio con `docs/ARQUITECTURA.md` y `docs/adr/`.
   - Listar las secciones de `docs/informe/` y los ADR afectados: los que citan una versión cambiada desde `lastCommit`, las secciones que citan un ADR cuyo Estado pasó a `Reemplazada por`, y las que se apoyan en fuentes cambiadas (`backend-ia/app/ml/`, el umbral de `matching_service.py`, `backend-ia/benchmarks/`, jobs de CI, esquema). Un ADR cuya decisión cambió se señala para reemplazo; uno incompleto se completa.
4. Actualizar directamente lo que es descriptivo y verificable en el código (versiones, endpoints, variables de entorno, esquema) y las secciones de `docs/informe/` afectadas, citando el artefacto. Lo que no se pueda verificar se marca `No disponible`.
5. Para cada cambio que implique una **decisión** no registrada, preguntarle al usuario el motivo, de a una pregunta por vez, mostrando la evidencia encontrada (archivo y commit). Nunca inventar la justificación.
6. Con la respuesta, crear un ADR nuevo desde `docs/adr/0000-plantilla.md`. Si reemplaza una decisión anterior, marcar el ADR viejo como `Reemplazada por ADR-XXXX` sin modificar el resto de su contenido.
7. Actualizar el índice `docs/adr/README.md`; debe tener una fila por cada archivo `NNNN-*.md` (salvo la plantilla).
8. Actualizar `docs/.docs-review.json` con la fecha de hoy y el SHA de `HEAD`.
9. Presentar un resumen de lo actualizado y lo pendiente. No commitear sin autorización; mensaje sugerido: `docs: revisión periódica de documentación técnica`.

## Reglas

- Se aplican las reglas del skill `documentacion`: un ADR aceptado se completa si quedó incompleto; si la decisión cambia, se reemplaza por uno nuevo.
- Si no hay evidencia ni respuesta del usuario sobre el motivo de una decisión, registrarla como pendiente en el resumen, no como ADR.
- Formato de ADR: Estado, Responsables, Decisión, Motivo, Alternativas, Consecuencias, Referencias, sin fechas en el cuerpo. Los Responsables son quienes tomaron la decisión según el repositorio.
- Un ADR de IA (modelos, umbral, moderación) enlaza en Referencias un resultado de `backend-ia/benchmarks/results/` y `backend-ia/benchmarks/README.md`.
- Los números del informe citan un artefacto (código, CI, PR, ADR, resultado del benchmark); si no existe, `No disponible`. No se escriben estimaciones como mediciones.
