# ADR-0021: Modelo de embeddings DINOv2 ViT-B/14 para el matching

- **Estado:** Aceptada
- **Responsables:** Agustín Díaz

## Decisión

Los embeddings del matching se generan con DINOv2 ViT-B/14 a 224 px, con el recorte de la mascota rellenado a cuadrado, en vectores de 768 dimensiones. Reemplaza a OpenCLIP ViT-B/32 y a la dimensión de 512 de [ADR-0013](0013-dimension-embedding-512.md).

## Motivo

- El matching es una re-identificación de individuos: tiene que distinguir a dos animales de la misma raza y color, y OpenCLIP codifica cómo se describe la foto, no rasgos finos del individuo.
- En el benchmark del equipo (596 fotos de 92 perros y gatos, fotos de consulta degradadas como las de un celular y la misma tasa de falsos positivos para todos los modelos), DINOv2 ViT-B/14 encuentra a la mascota en el 88,4% de los reportes, contra el 45,1% de OpenCLIP ViT-B/32 (mAP 0,802 contra 0,427, con intervalos de confianza que no se superponen).
- Corre en CPU sin GPU: el pipeline completo queda cerca de 0,4 s por reporte, muy por debajo del objetivo de 5 s.
- Los umbrales calibrados de forma independiente (0,42 y 0,61) confirman los configurados en producción (0,45 para registrar un match y 0,63 para notificar).

## Alternativas

DINOv2 ViT-L/14 (ordena mejor pero no encuentra más mascotas y triplica el costo de CPU), DINOv2 ViT-S/14 (81,3%, plan B si el hardware no alcanza), OpenCLIP ViT-L/14 (57,3%) y la fusión con OpenCLIP (no mejora a DINOv2 solo).

## Consecuencias

- Cambiar de modelo obligó a migrar la columna a 768 dimensiones y a regenerar los embeddings existentes, como anticipaba [ADR-0013](0013-dimension-embedding-512.md).
- Los umbrales se calibraron con fotos de animales conocidos: hay que recalibrarlos con los matches que confirmen o rechacen los usuarios.
- Por decisión del PM, la evidencia es el informe del benchmark; los scripts y el dataset se conservan fuera del repositorio.

## Referencias

[PR #238](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/238); [informe del benchmark de embeddings](evidencia/0021-dinov2/INFORME.html); [ADR-0018](0018-criterio-evolucion-tecnologica.md) (criterio de evolución tecnológica).
