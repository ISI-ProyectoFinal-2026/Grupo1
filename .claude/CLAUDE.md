# Proyecto Grupo1 — Patitas

@PROYECTO_REGLAS.md

## Documentación técnica

- Toda decisión de arquitectura o de tecnología (modelos de IA, librerías, infraestructura, patrones) se registra como ADR en `docs/adr/`, usando `docs/adr/0000-plantilla.md`.
- Un ADR aceptado no se edita: si la decisión cambia, se crea un ADR nuevo y el anterior pasa a `Reemplazada por ADR-XXXX`.
- La justificación de una decisión la aporta el equipo. Si no está documentada, preguntar; nunca inventarla.
- Revisión periódica: el hook `SessionStart` (`.claude/hooks/docs-review-check.mjs`) avisa cuando pasaron más de `intervalDays` desde la última revisión registrada en `docs/.docs-review.json`. En ese caso, ejecutar el skill `docs-review`.
