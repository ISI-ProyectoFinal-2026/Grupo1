# ADR-0026: Backup de la base y de las imágenes con un servicio Node en Docker

- **Estado:** Aceptada
- **Responsables:** Agustín Díaz

## Decisión

El backup diario de la base (dump con rotación local y en un bucket R2 propio) y la copia incremental de las imágenes se ejecutan en un servicio Node.js con TypeScript que corre como contenedor adicional de Docker Compose.

## Motivo

- Corre igual en Windows, Mac y Linux como un servicio más del stack, en lugar de depender del programador de tareas de cada sistema operativo.
- La lógica (rotación de dumps y selección incremental de imágenes) se puede probar con tests unitarios, como exige el TDD estricto del proyecto.
- El equipo trabaja en TypeScript y reutiliza `@aws-sdk/client-s3`, el mismo cliente que ya usa el backend para R2.

## Alternativas

Script de shell con rclone: menos código, pero la rotación es difícil de testear. Programadores del sistema operativo (Programador de tareas, cron): dependen del sistema operativo. Versionado de R2 para las imágenes: R2 no lo soporta.

## Consecuencias

- El backup solo corre mientras el stack de Docker está levantado.
- El punto de recuperación (RPO) es de 24 horas.
- La copia de imágenes nunca propaga borrados: el almacenamiento del bucket de backup solo crece (relacionado con el issue #288).

## Referencias

[Issue #263](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/263); [Issue #288](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/288); [ADR-0008](0008-cloudflare-r2-urls-prefirmadas.md); [API S3 de R2](https://developers.cloudflare.com/r2/api/s3/api/).
