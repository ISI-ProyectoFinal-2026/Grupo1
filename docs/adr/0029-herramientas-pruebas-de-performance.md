# ADR-0029: Herramientas de las pruebas de performance con k6, Lighthouse CI y un muestreador propio

- **Estado:** Pendiente
- **Responsables:** Pendiente de entrevista

## Decisión

Las pruebas de carga se escriben con k6 y exportan el dashboard web de k6 como HTML. El frontend se mide con Lighthouse CI (subida al sistema de archivos), y los recursos del backend se muestrean con un script Node propio y un balanceador propio para el escenario de escalabilidad.

## Motivo

- La tarea original nombra k6 como herramienta de carga.
- Pendiente de entrevista: el motivo de elegir Lighthouse CI, el muestreador de recursos propio y el balanceador propio.

## Alternativas

Prometheus con Grafana (o InfluxDB en lugar de Prometheus) para observabilidad: propuesto por el issue, no implementado. Pendiente de entrevista: si se descartó o queda para una entrega futura.

## Consecuencias

- Los resultados se midieron en una máquina de desarrollo compartida con otras aplicaciones, por lo que son indicativos y no reproducibles entre corridas.
- El stack de Prometheus y Grafana no está montado: no hay observabilidad continua, solo los reportes de cada corrida.

## Referencias

[Issue #40](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/40); [k6](https://grafana.com/docs/k6/latest/); [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci).
