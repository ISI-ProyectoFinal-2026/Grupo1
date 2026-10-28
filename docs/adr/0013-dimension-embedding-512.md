# ADR-0013: Dimensión del embedding de 512

- **Estado:** Reemplazada por [ADR-0021](0021-modelo-embeddings-dinov2.md)
- **Responsables:** Agustín Díaz (corrección); Matías Alvarado (especificación inicial) y Gabriel Valdivieso (esquema inicial)

## Decisión

Los embeddings se almacenan con 512 dimensiones, la salida del modelo OpenCLIP ViT-B-32.

## Motivo

- La especificación inicial preveía 1536 dimensiones, antes de elegir la variante del modelo.
- Al implementar la generación de embeddings se detectó la diferencia y se corrigió el esquema antes de almacenar datos.

## Consecuencias

- La dimensión queda atada al modelo: cambiarlo exige migrar la columna, el índice y los embeddings existentes, un costo a considerar según [ADR-0018](0018-criterio-evolucion-tecnologica.md).

## Referencias

[Issue #18](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/18), [PR #56](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/56).
