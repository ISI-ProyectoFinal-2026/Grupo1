# ADR-0027: Mantener el JWT en localStorage y no migrarlo a una cookie httpOnly en esta entrega

- **Estado:** Aceptada
- **Responsables:** Equipo (Matías Alvarado, PM)

## Decisión

El token de sesión sigue persistido en localStorage. La migración a una cookie httpOnly se descarta para esta entrega y queda como mejora futura.

## Motivo

- La migración toca el login, el chat en tiempo real con Socket.IO, la configuración de CORS y la protección CSRF.
- Un cambio de ese alcance puede romper los tests e2e justo antes de la etapa de testing.
- El riesgo de XSS ya tiene mitigaciones vigentes: la sesión se valida contra la base con `token_version`, la caché se limpia al cerrar sesión y React escapa el contenido por defecto.

## Alternativas

Migrar el JWT a una cookie httpOnly antes de la entrega; se descartó por el alcance y el riesgo descritos en el motivo.

## Consecuencias

- El token sigue expuesto ante un ataque XSS que logre ejecutar código en el frontend; se acepta como deuda técnica.
- La migración se reevalúa después de la entrega según [ADR-0018](0018-criterio-evolucion-tecnologica.md).

## Referencias

[Issue #215](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/215), [issue #265](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/265), [ADR-0007](0007-estado-y-datos-frontend.md).
