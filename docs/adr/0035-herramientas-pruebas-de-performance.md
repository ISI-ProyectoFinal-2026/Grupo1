# ADR-0035: Herramientas de las pruebas de performance con k6, Lighthouse CI y un muestreador propio

- **Estado:** Aceptada
- **Responsables:** Franco Marín

## Decisión

Las pruebas de carga se escriben con k6 y exportan el dashboard web de k6 como HTML. El frontend se mide con Lighthouse CI (subida al sistema de archivos), y los recursos del backend se muestrean con un script Node propio y un balanceador propio para el escenario de escalabilidad. La observabilidad se monta con Prometheus v3.15.1 y Grafana 12.4.14 en Docker, en versión liviana y solo local (visor anónimo): k6 1.3.0 envía métricas por `experimental-prometheus-rw` y el muestreador propio expone CPU/RSS del backend y conexiones de PostgreSQL, que Prometheus consulta cada 5 s.

## Motivo

- k6: la tarea original lo nombra como herramienta de carga. Lighthouse CI: el issue lo propone para medir el frontend, y su subida al sistema de archivos evita publicar el reporte en una URL pública.
- Versión liviana de Prometheus y Grafana (sin cAdvisor, node-exporter ni postgres_exporter) y balanceador propio en Node: el overhead de Docker Desktop (`com.docker.backend`) llegó a ~79 % de un núcleo con nginx en contenedor y distorsionaba las mediciones; con Prometheus y Grafana livianos promedió 9,7 % (máximo 58,7 %) durante la carga.
- Muestreador de recursos propio: sin exportadores, hacía falta una fuente de CPU, memoria y conexiones a PostgreSQL.

## Alternativas

- InfluxDB en lugar de Prometheus: propuesta del issue, descartada.
- Balanceador nginx en Docker para la escalabilidad: probado y descartado por el overhead de Docker Desktop medido (`com.docker.backend` en ~79 % de un núcleo); se usó un balanceador propio en Node.
- Stack completo de exportadores (cAdvisor, node-exporter, postgres_exporter): propuesto por el issue y descartado al elegir la versión liviana, por el mismo overhead de Docker.

## Consecuencias

- Los resultados se midieron en una máquina de desarrollo compartida con otras aplicaciones, por lo que son indicativos y no reproducibles entre corridas.
- Prometheus y Grafana están montados en versión liviana: sin cAdvisor, node-exporter ni postgres_exporter. Suman overhead medible en la máquina de desarrollo, y los resultados con Grafana activo no son comparables directamente con los obtenidos sin él (cifras en el informe, sección 1.3.3.5).

## Referencias

[Issue #40](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/40); [k6](https://grafana.com/docs/k6/latest/); [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci).
