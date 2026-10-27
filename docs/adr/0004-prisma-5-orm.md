# ADR-0004: Prisma 5 como ORM y única fuente de migraciones

- **Estado:** Aceptada
- **Responsables:** Gabriel Valdivieso

## Decisión

Prisma 5 es el ORM del backend principal y la única fuente de migraciones del esquema.

## Motivo

- El equipo lo eligió por su integración con TypeScript y por lo que ofrece: un cliente tipado generado desde el esquema (los cambios incompatibles se detectan al compilar), un esquema declarativo único que documenta el modelo y migraciones SQL versionadas y reproducibles.
- No se hizo una evaluación formal de alternativas.
- No se migró a Prisma 7: no se identificó una mejora significativa de rendimiento o calidad que justificara un salto de dos versiones mayores con incompatibilidades, según el criterio de [ADR-0018](0018-criterio-evolucion-tecnologica.md).

## Alternativas

TypeORM, Sequelize y Drizzle no se evaluaron formalmente.

## Consecuencias

- Prisma no soporta de forma nativa los tipos `geometry` (PostGIS) ni `vector` (pgvector): se declaran como `Unsupported` y se consultan con SQL crudo.
- El backend de IA mapea con SQLAlchemy un subconjunto de columnas sin migrar el esquema, y la sincronización entre ambos mapeos no se verifica automáticamente ([#213](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/213)).

## Referencias

[PR #47](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/47); [issue #213](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/213); [ADR-0018](0018-criterio-evolucion-tecnologica.md).
