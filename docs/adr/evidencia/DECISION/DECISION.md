# Decisión: modelo de embeddings para el matching (para implementar)

Fecha: 2026-10-27 · Proyecto Patitas (Grupo 1) · Sustento: `INFORME.md` y el doc
"Selección del modelo de embeddings visuales para el matching de mascotas"
(https://claude.ai/artifact/RTiBbH6utLT9DEvZWWKFtg).

## Decisión

Usar **DINOv2 ViT-B/14** (`vit_base_patch14_dinov2.lvd142m`, vía timm) en `backend-ia`, reemplazando a OpenCLIP ViT-B-32.

| Parámetro | Valor |
| --- | --- |
| Checkpoint | `vit_base_patch14_dinov2.lvd142m` |
| Resolución de entrada | 224 × 224 px |
| Preproceso | Recorte YOLOv8n → padding a cuadrado con color `(124, 116, 104)` → transform de timm |
| Selección de mascota | Mayor confianza entre detecciones con área ≥ 25% del animal más grande (`MIN_RELATIVE_AREA = 0.25`) |
| Dimensión del vector | 768, normalizado L2 |
| Columna en BD | `report_embeddings.embedding vector(768)`, índice HNSW `vector_cosine_ops` |
| Umbral de match | 0,45 (`MATCH_THRESHOLD`) |
| Umbral de notificación | 0,63 (`NOTIFY_THRESHOLD`) |
| Consulta de candidatos | Tipo opuesto, ≤ 5 km, ≤ 30 días, `LIMIT 5`, operador `<=>` |

## Por qué (resumen de métricas, protocolo calle)

| Modelo | Mascota encontrada (pool 20) | mAP | ms/img CPU |
| --- | --- | --- | --- |
| OpenCLIP B-32 (POC) | 45,1% | 0,427 | 72 |
| OpenCLIP L-14 | 57,3% | 0,583 | 940 |
| DINOv2 S/14 | 81,3% | 0,729 | 64 |
| **DINOv2 B/14 + padding** | **88,4%** | **0,802** | **283** |
| DINOv2 L/14 | 88,1% | 0,852 | 917 |

- Umbrales calibrados a ciegas en el benchmark (3% y 0,3% de falsos positivos): 0,42 / 0,61, consistentes con 0,45 / 0,63.
- Dataset: 596 fotos de 92 animales (47 perros, 45 gatos) de Wikimedia Commons, curado.

## Alternativas

- DINOv2 L/14 si hay GPU o CPU ociosa: checkpoint `vit_large_patch14_dinov2.lvd142m`, dimensión 1024, umbrales 0,46 / 0,67.
- DINOv2 S/14 si el hardware no alcanza: 64 ms por imagen, 81% de mascotas encontradas.
- No guardar embeddings de CLIP salvo que entre búsqueda por texto.

## Implementación (rama `dbeagus/features`)

1. `backend-ia/app/ml/pipeline.py`: DINOv2 B/14 a 224 px, padding, `MIN_RELATIVE_AREA`.
2. `backend-ia/app/services/matching_service.py`: umbrales 0,45 / 0,63.
3. `backend-ia/app/services/embedding_service.py`: inferencia en `asyncio.to_thread`.
4. `backend/prisma/migrations/20261014000000_dinov2_embedding_dimension`: `vector(512)` → `vector(768)` con tabla de respaldo.
5. `backend-ia/scripts/reembed_reports.py`: regenera los embeddings de los reportes existentes después de migrar.
6. Pendiente después del merge: registrar matches confirmados/rechazados para recalibrar umbrales con datos reales; si se comprime en el cliente, no bajar de 640 px ni JPEG calidad 70.
