# ADR-0006: Stack del frontend con React 19, Vite, TypeScript, Tailwind 3 y React Router 6

- **Estado:** Aceptada
- **Responsables:** Gabriel Valdivieso (revisión: Matías Alvarado)

## Decisión

El frontend se implementa con React 19, Vite, TypeScript y Tailwind CSS 3, con React Router 6 para la navegación.

## Motivo

- El equipo las eligió por su estabilidad, la documentación disponible y el conocimiento previo de sus integrantes.
- Se optó por Tailwind 3 y React Router 6 aunque ya existían las versiones 4 y 7: las adoptadas tenían más documentación y ejemplos, y el equipo ya sabía usarlas, lo que reducía el riesgo en un proyecto con plazo acotado.

## Consecuencias

- Una migración futura a Tailwind 4 o React Router 7 se evaluará con el criterio de [ADR-0018](0018-criterio-evolucion-tecnologica.md), cuando exista una mejora medible que la justifique.

## Referencias

[PR #102](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/102); [ADR-0018](0018-criterio-evolucion-tecnologica.md).
