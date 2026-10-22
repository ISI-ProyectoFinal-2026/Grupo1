# ADR-0007: Estado y datos en el frontend con TanStack Query, zustand y Axios

- **Estado:** Aceptada
- **Responsables:** Gabriel Valdivieso; Agustín Díaz (sesión persistida)

## Decisión

El frontend separa tres responsabilidades: TanStack Query para el estado del servidor, zustand para el estado del cliente (la sesión) y Axios como cliente HTTP.

## Motivo

- El motivo original de la elección no quedó documentado; el equipo validó después que las tres librerías son adecuadas.
- TanStack Query integra en una misma caché los datos de la API REST y los mensajes de Socket.IO, refresca los reportes pendientes de verificación por IA y las notificaciones, e invalida solo los datos afectados por cada acción.
- zustand permite leer la sesión fuera de los componentes (lo requiere el interceptor HTTP) y persistirla con un middleware, algo que React Context no ofrece.
- Axios centraliza en interceptores el envío del token y el cierre de sesión ante una respuesta 401.

## Alternativas

SWR ofrece menos soporte para mutaciones e invalidación; Redux o RTK Query agregarían complejidad innecesaria para un único estado de sesión.

## Consecuencias

- El token de sesión se persiste en localStorage por defecto, lo que lo expone ante un ataque XSS. Es deuda técnica: la migración a cookie httpOnly se evalúa según [ADR-0018](0018-criterio-evolucion-tecnologica.md) ([#215](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/215)).
- Mitigaciones vigentes: validación de sesiones contra la base con `token_version` y limpieza de caché al cerrar sesión.

## Referencias

[PR #100](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/100), [PR #102](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/102), [PR #144](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/144); [issue #215](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/215).
