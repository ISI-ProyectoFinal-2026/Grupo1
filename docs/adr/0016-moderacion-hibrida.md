# ADR-0016: Moderación híbrida con filtro automático por IA y denuncias de usuarios

- **Estado:** Aceptada
- **Responsables:** Franco Marín (denuncias); Agustín Díaz (estado pendiente hasta la moderación IA y visibilidad solo para el dueño); Matías Alvarado (roles y moderación accionable); Gabriel Valdivieso (panel de moderación)

## Decisión

La moderación combina un filtro automático por IA al publicar con denuncias de usuarios resueltas por moderadores.

## Motivo

- La IA filtra en volumen y sin costo humano, pero no detecta todo el contenido fuera de lugar.
- Las denuncias de la comunidad cubren lo que la IA no detecta.
- Un reporte no visible para el público (pendiente o rechazado) solo lo ve su dueño.

## Consecuencias

- Hoy la resolución de denuncias es manual. Se propone ocultar automáticamente un reporte al alcanzar un mínimo de denuncias de usuarios verificados, con revisión final de un moderador ([#218](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/218)).

## Referencias

[Issue #19](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/19), [issue #218](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/218); PR [#57](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/57), [#58](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/58), [#191](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/191), [#193](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/193), [#195](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/195).
