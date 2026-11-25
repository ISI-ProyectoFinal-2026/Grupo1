# ADR-0034: Cola Redis con BullMQ para el pipeline IA de los reportes

- **Estado:** Aceptada
- **Responsables:** Gabriel Valdivieso

## Decisión

Al crear un reporte, o al cambiar sus fotos, el backend encola un job en Redis con BullMQ (`{ reportId, imageUrl }`, un job por reporte) y un worker del mismo backend lo procesa contra el Backend IA con reintentos y backoff exponencial. Sin `REDIS_URL`, o si Redis no acepta el job en 5 s, el pipeline corre en proceso como antes.

## Motivo

- La llamada directa fire-and-forget no tenía cola, ni reintentos persistentes, ni visibilidad de los fallos (issue #177).
- Los jobs sobreviven a un reinicio del backend y cada intento fallido queda en el log.
- La arquitectura objetivo del proyecto ya preveía una cola en Redis para este pipeline.
- BullMQ 5 (con ioredis) cubre reintentos, backoff e idempotencia por `jobId` sin código propio; la línea 6 cambió de cliente de Redis.

## Alternativas

Mantener la llamada directa con reintentos en memoria: queda como fallback, porque los reintentos se pierden si el proceso se reinicia.

## Consecuencias

- Suma un servicio (Redis) a la demo; se publica solo en `127.0.0.1` porque no tiene contraseña.
- Si se cambia la foto mientras el job del mismo reporte está en ejecución, la foto nueva no se encola: se procesa en la reconciliación de pendientes (hasta unos 7 minutos después).
- Si Redis vuelve justo después del timeout de 5 s, el pipeline puede correr dos veces; el veredicto se escribe una sola vez.

## Referencias

[Issue #177](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/177); [PR #378](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/378); [ADR-0029](0029-backend-unico-acceso-base-de-datos.md); [ADR-0031](0031-demo-local-docker-compose.md).
