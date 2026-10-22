# Fuentes de las imágenes

| Carpeta | Fuente (nombre del dataset o "propia") | URL | Licencia | Cantidad | Fecha de carga | Cargó |
|---|---|---|---|---|---|---|
| `moderation/` (11 carpetas, prefijo `oi_`) | Open Images V7, splits validation y test, vía `download_datasets.py --seed 42` | https://storage.googleapis.com/openimages/web/index.html | CC BY 2.0 (autor y URL por imagen en `manifest.csv`) | 440 | 2026-10-21 | Script |
| `matching/dog_dfn_*` | DogFaceNet, versión 224resized (Mougeot, Li, Jia, 2019) | https://zenodo.org/records/12578449 | CC BY 4.0 | 319 (60 perros) | 2026-10-21 | Script |
| `moderation/no_animal/plush/` | Recolección manual de la web (incluye publicaciones de MercadoLibre y una foto de stock generada con IA) | — | No registrada | 19 | 2026-10-21 | Matías Alvarado |
| `moderation/no_animal/drawing/` | Recolección manual de la web (render 3D de personaje animado) | — | No registrada | 1 | 2026-10-21 | Matías Alvarado |
