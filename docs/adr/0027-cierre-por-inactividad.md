# ADR-0027: Cierre por inactividad con columna de actividad propia y tarea periódica en el backend

- **Estado:** Aceptada
- **Responsables:** Franco Marín

## Decisión

El tiempo de inactividad de un reporte se mide con una columna propia, `lastActivityAt`, que solo reinician las acciones de su dueño: editar el reporte, "Seguir mostrando", confirmar una coincidencia y enviar un mensaje en un chat del reporte. Una tarea periódica en el backend avisa a los 30 y 37 días y cierra el reporte a los 38 días, con al menos 24 horas entre el segundo aviso y el cierre.

## Motivo

- Las actividades que reinician los días son las que involucran al dueño, así se sabe que sigue activo (criterio del equipo).
- `updatedAt` se actualiza con cualquier escritura, incluidas las del sistema (veredicto de la IA, ocultamiento automático, restauración, flyer), por lo que reiniciaría el contador sin que el dueño actúe.
- El backend ya ejecuta tareas periódicas en proceso, por lo que no se suma infraestructura nueva.

## Alternativas

`updatedAt`: descartada porque mezcla escrituras del sistema con acciones del dueño. Contar coincidencias sugeridas por la IA: descartada porque no involucran al dueño y exigiría modificar el servicio de IA. Máximo calculado con uniones sobre mensajes y coincidencias: descartada porque encarece cada barrido. Cola o cron externo: descartados porque suman infraestructura.

## Consecuencias

- Cada acción del dueño que cuenta como actividad debe actualizar `lastActivityAt` de forma explícita, y se agrega una migración; los mensajes del otro usuario y las confirmaciones de la otra parte no reinician el contador.
- La tarea corre en cada instancia del backend sin bloqueo entre instancias, por lo que los avisos y el cierre se reclaman con escrituras condicionales para no duplicarse.
- Los reportes ocultos no se cierran automáticamente: el cierre solo es válido para reportes publicados.

## Referencias

[Issue #264](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/264); [Issue #210](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/210); [Issue #221](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/221); [ADR-0004](0004-prisma-5-orm.md).
