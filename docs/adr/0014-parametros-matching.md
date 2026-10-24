# ADR-0014: Parámetros del matching

- **Estado:** Pendiente
- **Responsables:** Agustín Díaz (implementación original); Gabriel Valdivieso (corrección de L2 a coseno); Matías Alvarado (confirmación y rechazo)

## Decisión

Se sugiere una coincidencia cuando la similitud coseno entre embeddings supera un umbral, la otra mascota se reportó a menos de 5 km, el reporte es reciente y de tipo opuesto (perdida o encontrada). Se muestran las 5 mejores y el dueño confirma manualmente.

## Motivo

- La distancia coseno es la métrica adecuada para embeddings normalizados y la que usa el índice vectorial; la distancia euclídea usada al inicio subestimaba la similitud.
- El radio de 5 km cubre con margen la distancia a la que suelen aparecer las mascotas perdidas según estudios publicados (la mayoría a menos de 1,6 km).
- La confirmación manual evita que un falso positivo resuelva un reporte.

## Consecuencias

- El umbral (0,75) y la ventana temporal (30 días) son provisionales: el umbral se calibra con el benchmark y se propone ampliar la ventana a 90 días, porque hay mascotas que se recuperan casi tres meses después ([#217](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/217)).
- No hay datos publicados de distancia para perros: el radio se revisará con datos del piloto.

## Referencias

[PR #56](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/56), [PR #156](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/156), [PR #192](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/192), [issue #217](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/217); [Huang et al. (2018)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5789300/); [Lord et al. (2007)](https://pubmed.ncbi.nlm.nih.gov/17223754/); resultados del benchmark de matching: No disponible (el ADR pasa a Aceptada cuando exista el enlace).
