# ADR-0022: Preferencias de notificación y ubicación en una tabla propia

- **Estado:** Aceptada
- **Responsables:** Franco Marín

## Decisión

Las preferencias de notificación, el consentimiento y la última ubicación del usuario se guardan en una tabla propia vinculada uno a uno con el usuario, y no como columnas de `users`.

## Motivo

- Mantener `users` limpio: son unos diez campos que no pertenecen a la identidad del usuario.
- La ubicación se actualiza cada vez que el usuario abre la app; escribirla en `users` mezclaría un dato de alta frecuencia con los datos de login.
- El modelo queda listo para sumar canales (email, push) sin tocar `users`.

## Alternativas

Columnas directas en `users`, descartadas por los motivos anteriores.

## Consecuencias

- Una tabla más y un `join` al consultar las preferencias.
- Sin fila, el servicio aplica los valores por defecto.

## Referencias

[Issue #33](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/33).
