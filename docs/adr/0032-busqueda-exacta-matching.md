# ADR-0032: Búsqueda exacta de candidatos en el matching por similitud

- **Estado:** Aceptada
- **Responsables:** Gabriel Valdivieso

## Decisión

La búsqueda de candidatos del matching filtra primero por estado, tipo opuesto, radio y ventana de días, y recién después ordena por similitud coseno sobre ese subconjunto (búsqueda exacta), sin usar el índice HNSW para resolver el orden.

## Motivo

- Con el índice HNSW, pgvector recorre una cantidad acotada de vecinos aproximados y filtra después: si los más parecidos están lejos o fuera de la ventana, el match cercano se pierde sin aviso (reproducido en el test del issue #336).
- El resultado no depende del plan que elija PostgreSQL ni de la versión de pgvector.
- El subconjunto filtrado (radio de 5 km, 90 días, tipo opuesto) es chico, así que ordenar sin índice tiene un costo bajo.

## Alternativas

`hnsw.iterative_scan = relaxed_order`: descartada porque sigue siendo aproximada, está acotada por `hnsw.max_scan_tuples` y exige `SET LOCAL` dentro de una transacción.

## Consecuencias

- El índice HNSW deja de usarse en esta consulta; si un mismo radio llegara a concentrar miles de reportes, la búsqueda sería más lenta.
- El preflight de la demo verifica que pgvector esté instalado con soporte de HNSW.

## Referencias

[Issue #336](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/336); [ADR-0003](0003-postgresql-postgis-pgvector.md); [ADR-0014](0014-parametros-matching.md); [ADR-0029](0029-backend-unico-acceso-base-de-datos.md).
