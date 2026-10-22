# Datasets de benchmark — Backend IA

Imágenes para medir los modelos de IA con métricas reproducibles. Las imágenes **no se versionan** (por tamaño y por las licencias de los datasets): solo se commitean esta estructura, este README y `SOURCES.md`.

Formatos aceptados: `.jpg`, `.jpeg`, `.png`, `.webp`.

## 0. Descarga reproducible

```bash
cd backend-ia
python benchmarks/download_datasets.py            # --per-class 40 --dogs 60 --seed 42
```

- Solo usa la librería estándar de Python. Los archivos de anotaciones se cachean en `benchmarks/.cache/` (no versionado).
- La semilla fija (`--seed`) hace que la misma ejecución elija siempre las mismas imágenes.
- Genera `manifest.csv` (sí versionado): una fila por imagen con su tarea, etiqueta, fuente, ID original, licencia, autor y URL. Es la evidencia de qué datos se usaron para cada métrica.

Fuentes que descarga:

| Fuente | Licencia | Destino | Criterio de selección |
|---|---|---|---|
| [Open Images V7](https://storage.googleapis.com/openimages/web/index.html), splits validation y test | Imágenes CC BY 2.0 (autor por imagen en el manifiesto) | `moderation/` | Animales reales: un solo tipo de animal, caja ≥ 10% de la imagen, sin cajas de grupo ni representaciones. Sin animal: ninguna etiqueta de la rama "Animal" (cajas o etiquetas verificadas por humanos). Dibujos: animales con `IsDepiction` y ningún animal real. |
| [DogFaceNet](https://zenodo.org/records/12578449), versión 224resized | CC BY 4.0 | `matching/dog_dfn_NNNN/` | Perros con 3 fotos o más; hasta 6 fotos por perro. |

Las imágenes cargadas a mano (propias o de la web) conviven con las descargadas: usan prefijos distintos (`oi_` para Open Images, `dog_dfn_` para DogFaceNet) y se registran en `SOURCES.md`.

## 1. `matching/` — Matching por similitud

Mide si el sistema reconoce **al mismo animal** en fotos distintas.

Estructura: una carpeta por animal individual, con **2 fotos o más** de ese mismo animal.

```
matching/
├── dog_0001/
│   ├── 01.jpg
│   ├── 02.jpg
│   └── 03.jpg
├── dog_0002/
│   ├── 01.jpg
│   └── 02.jpg
└── cat_0001/
    ├── 01.jpg
    └── 02.jpg
```

- Nombre de carpeta: `<especie>_<número de 4 dígitos>` (`dog_0001`, `cat_0001`) para fotos propias; las descargadas de DogFaceNet usan `dog_dfn_<número>`.
- Todas las fotos de una carpeta deben ser del **mismo individuo**. Dos perros distintos de la misma raza van en carpetas distintas.
- Conviene que las fotos varíen en ángulo, luz y fondo, como pasaría en un reporte real.
- Objetivo mínimo orientativo: 30 individuos con 3 fotos cada uno.

## 2. `moderation/` — Moderación de imágenes

Mide si el sistema decide bien si una imagen **contiene un animal real**.

| Carpeta | Contenido | Veredicto esperado |
|---|---|---|
| `animal/dog/` | Perros reales | Aceptar |
| `animal/cat/` | Gatos reales | Aceptar |
| `animal/rabbit/` | Conejos reales | Aceptar |
| `animal/turtle/` | Tortugas reales | Aceptar |
| `animal/bird/` | Aves reales | Aceptar |
| `animal/other/` | Otras mascotas reales (hámster, caballo, etc.) | Aceptar |
| `no_animal/plush/` | Peluches y juguetes con forma de animal | Rechazar |
| `no_animal/drawing/` | Representaciones de animales: dibujos, renders 3D, estatuas, artesanías, estampados | Rechazar |
| `no_animal/object/` | Objetos sin animales | Rechazar |
| `no_animal/person/` | Personas sin animales | Rechazar |
| `no_animal/landscape/` | Paisajes, calles, interiores vacíos | Rechazar |
| `no_animal/screenshot/` | Capturas de pantalla, memes, texto | Rechazar |

- Una imagen va en una sola carpeta.
- Si una foto tiene una persona **con** su perro, va en `animal/dog/` (hay un animal real).
- Objetivo mínimo orientativo: 20 imágenes por carpeta.

## 3. Registro de fuentes

Cada vez que cargues imágenes, anotá su origen en `SOURCES.md`. Es obligatorio para citar los datasets en el informe (sección 4, Referencias) y para respetar sus licencias.
