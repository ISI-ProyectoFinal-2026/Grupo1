# ADR-0019: El comercio es un perfil del usuario y no un rol

- **Estado:** Aceptada
- **Responsables:** Agustín Díaz (perfil de comercio); Matías Alvarado (roles sin `comercio`)

## Decisión

Un comercio se modela como un perfil propio vinculado uno a uno con un usuario, y no como un valor del rol.

## Motivo

- "Es un perfil de business, ya que si un comercio se registra debería tener su perfil con sus métricas de segmentación de clientes, KPIs, etc." (equipo).
- El perfil ya existía vinculado uno a uno con el usuario; agregar el rol habría creado dos fuentes de verdad.
- Con un único rol por usuario, el titular de un comercio no podría ser también moderador.

## Alternativas

El rol `comercio` previsto en el PDD v1.0, descartado por los motivos anteriores.

## Consecuencias

- Cualquier usuario puede registrar un comercio; los permisos del comercio dependen de tener el perfil, no del rol.
- Hoy las métricas del perfil se limitan a visitas y contactos; la segmentación de clientes depende del modelo de monetización pendiente en #30.

## Referencias

[Issue #31](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/31), [issue #76](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/76), [issue #30](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/30); PR [#193](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/193).
