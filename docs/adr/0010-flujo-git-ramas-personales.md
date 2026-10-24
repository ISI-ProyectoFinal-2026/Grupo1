# ADR-0010: Flujo de trabajo con Git, ramas personales y revisión obligatoria

- **Estado:** Aceptada
- **Responsables:** Matías Alvarado

## Decisión

Cada integrante trabaja en una rama personal permanente (`<nombre>/features`) desde la que abre pull requests hacia `main`. Toda integración requiere la aprobación de otro integrante, y los commits siguen Conventional Commits.

## Motivo

- Cada integrante desarrolla y verifica sus propias funcionalidades: una rama por persona refleja esa organización y evita la proliferación de ramas por funcionalidad.
- La revisión obligatoria asegura que todo cambio en `main` sea visto por al menos otra persona.
- Historial: al inicio se integró desde una rama `develop` para probar el flujo; una vez validado, se adoptó el esquema de ramas personales y se documentó.
- La revisión se aplicó en la práctica: el setup inicial del frontend se integró sin revisión y su autor lo revirtió el mismo día para presentarlo por el flujo de revisión. Matías Alvarado revisó 36 de las 41 PRs del resto del equipo y Agustín Díaz revisó 16 de las de Matías.

## Alternativas

La rama `develop` compartida se usó solo como prueba y se abandonó.

## Consecuencias

- Las ramas permanentes acumulan diferencias con `main`; se mitiga sincronizándolas después de cada integración.
- En la práctica cada autor integra su PR después de la aprobación, y se usan ramas cortas por tarea cuando conviene aislar un cambio; [WORKFLOW](../WORKFLOW.md) lo refleja.

## Referencias

[PR #52](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/52) (cierra [#14](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/14)), [PR #45](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/45), [PR #47](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/47), [PR #99](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/99) a [#102](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/102); [WORKFLOW](../WORKFLOW.md).
