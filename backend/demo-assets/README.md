# Imágenes del seed de demo

Fotos que usa `npm run seed:demo` (#371) y el smoke test de la demo. Todas salen de Wikimedia Commons, con licencia de dominio público o CC0, así que no exigen atribución; igual se registra la fuente de cada una en `manifest.json` (autor, URL, licencia y sha256).

Las fotos se achicaron a 800 px de lado mayor (JPEG calidad 80): el modelo recorta la mascota y la procesa a 224 px, así que una resolución mayor no cambia el embedding y solo agrega peso al repositorio.

## Casos de matching

Puntajes medidos con el Backend IA real (YOLOv8n + DINOv2 ViT-B/14) sobre estos mismos archivos:

| Caso | Fotos | Similitud | Umbral |
|---|---|---|---|
| Par de la misma mascota | `toby-lost.jpg` y `toby-found.jpg` | 0,695 | supera 0,63 (notifica) |
| Reporte del smoke contra el perdido | `toby-lost.jpg` y `toby-smoke.jpg` | 0,646 | supera 0,63 |
| Negativo | `toby-lost.jpg` y `golden-found.jpg` | -0,067 | no supera 0,45 (sin coincidencia) |

El seed vuelve a verificar el par y el negativo cada vez que corre y termina con error si no se cumplen.

Si se cambia una foto, el checkpoint del modelo o `DINO_INPUT_SIZE`, hay que volver a medir y actualizar esta tabla y el guion de la demo (`docs/demo/guion.md`).
