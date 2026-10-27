# ADR-0005: Servicio de IA con FastAPI

- **Estado:** Aceptada
- **Responsables:** Agustín Díaz (servicio); Matías Alvarado (documento de arquitectura)

## Decisión

El servicio de IA se implementa con FastAPI.

## Motivo

- El equipo lo eligió por su facilidad de uso y su rendimiento: el modelo asíncrono atiende entrada y salida (descarga de imágenes, consultas con SQLAlchemy async) sin bloquear el servicio.
- La validación con Pydantic, la inyección de dependencias y la documentación OpenAPI automática reducen el código necesario.
- Frente a Django, es más liviano para un servicio de cuatro endpoints y no incorpora un ORM con migraciones propias, que chocaría con Prisma como único dueño del esquema.
- El tiempo de respuesta lo domina la inferencia de los modelos (≈0,68 s por imagen), no el framework (milisegundos por request); la latencia de cada modelo se mide en el benchmark.

## Alternativas

Flask y Django no se evaluaron formalmente.

## Consecuencias

- La inferencia, intensiva en CPU, debe ejecutarse fuera del event loop: la moderación lo hace con `asyncio.to_thread`; el endpoint de embeddings todavía no ([#214](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/214)).

## Referencias

[PR #56](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/56); [issue #214](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/214); [QA del pipeline de IA](../QA_IA_PIPELINE.md); [ADR-0001](0001-monorepo-y-dos-backends.md).
