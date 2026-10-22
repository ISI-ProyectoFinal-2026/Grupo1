# ADR-0003: Una sola base de datos, PostgreSQL 16 con PostGIS y pgvector

- **Estado:** Aceptada
- **Responsables:** Gabriel Valdivieso

## Decisión

Una única base PostgreSQL 16 con las extensiones PostGIS (datos geográficos) y pgvector (búsqueda vectorial), en lugar de un motor vectorial separado como Faiss.

## Motivo

- La búsqueda de coincidencias combina en una sola consulta SQL la similitud visual (distancia coseno con índice HNSW), la distancia geográfica, la antigüedad del reporte y su tipo. Con un motor separado habría que consultar dos sistemas, filtrar por ubicación y fecha después de la búsqueda vectorial (con riesgo de descartar todos los candidatos) y mantener sincronizados dos almacenamientos.
- Faiss es una librería en memoria, no una base de datos: persistencia, respaldos y concurrencia quedarían a cargo del equipo.
- Una sola base simplifica el despliegue, el CI y las migraciones con Prisma.
- La versión 16 no surgió de una evaluación: venía en la imagen PostGIS usada al inicio y se mantuvo al cambiar de imagen ([ADR-0011](0011-imagen-docker-postgres.md)).

## Alternativas

Faiss como motor vectorial separado, descartado por los motivos anteriores.

## Consecuencias

- La búsqueda vectorial escala hasta lo que soporte una instancia de PostgreSQL con HNSW, suficiente para el volumen esperado; si el volumen creciera órdenes de magnitud, habría que reevaluar un motor dedicado.

## Referencias

[PR #47](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/47); [ADR-0011](0011-imagen-docker-postgres.md), [ADR-0018](0018-criterio-evolucion-tecnologica.md).
