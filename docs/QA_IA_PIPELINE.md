# QA - Integración del pipeline de IA (Reports → Backend-IA → pgvector) - PATITAS

**Fecha de verificación**: 2026-08-26
**Issue**: #127 — [TASK] Integration: IA Processing (Reports → Backend-IA → pgvector)
**Alcance**: flujo completo de creación de un reporte con imagen: Backend Principal (Express) → disparo fire-and-forget → Backend IA (YOLOv8n + OpenCLIP) → `report_embeddings` (pgvector) → `report_matches` → `GET /api/reports/:id/matches` → UI de detalle del reporte.
**Estado general**: ✅ Funcional — **2 bugs bloqueantes encontrados y corregidos**

---

## Resumen ejecutivo

El pipeline estaba roto en su parte central. La query de matching calculaba la similitud con el operador equivocado de pgvector (`<->`, distancia L2, en lugar de `<=>`, distancia coseno), de modo que **nunca se podía crear un match**: dos fotos de la misma mascota, que dan 0.87 de similitud coseno, quedaban en 0.49 con la fórmula vieja, por debajo del umbral de 0.75. Los tests no lo detectaban porque sembraban vectores idénticos, que dan distancia 0 en cualquier métrica.

El segundo bug es de disponibilidad: los reintentos del disparo al Backend IA viven en memoria y se agotan en ~36s, así que cualquier caída más larga dejaba el reporte en `pending` para siempre, sin embedding, invisible en el feed y sin posibilidad de matchear. La base de desarrollo tenía **4 reportes en ese estado** al empezar esta verificación.

Con ambos arreglados, el pipeline completo funciona y cumple el objetivo de performance con holgura: **~0.68s de inferencia por imagen** contra un presupuesto de 5s.

---

## 1. Checklist de la issue

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| 1 | Reporte se crea en backend Express | ✅ | `POST /api/reports` → `201`, `status: "pending"` cuando hay imagen (sección 3) |
| 2 | Backend dispara Backend-IA (fire-and-forget) sin errores | ✅ | La creación responde de inmediato; el veredicto llega después y cambia el status (sección 3) |
| 3 | Backend-IA procesa imagen YOLO + OpenCLIP | ✅ | 5/5 imágenes con perro → `201`; imagen sin mascota → `422` (secciones 3 y 4) |
| 4 | Embeddings se guardan en pgvector correctamente | ✅ | 512 dims, normalizados, 1 fila por reporte en `report_embeddings` (sección 5) |
| 5 | Consulta de matching retorna similares ordenados | ✅ **post-fix** | Roto antes del arreglo. Ahora devuelve 87% y 85% ordenados desc (secciones 2.1 y 6) |
| 6 | Performance: processing < 5s por imagen | ✅ | ~0.68s de inferencia pura, 0.87–1.6s end-to-end en caliente (sección 7) |
| 7 | No hay reportes stuck en 'processing' state | ✅ **post-fix** | Roto antes del arreglo (4 reportes atascados). Ahora hay reconciliación (secciones 2.2 y 8) |

> Nota sobre el ítem 7: el esquema no tiene un estado `processing`. El equivalente real es `pending`, que es donde queda un reporte con imagen hasta que llega el veredicto del Backend IA (ver `ReportStatus` en `backend/prisma/schema.prisma`).

---

## 2. Hallazgos

### 2.1 [BUG] La similitud se calculaba con distancia L2 en vez de coseno — Severidad: **CRÍTICA** — ✅ Corregido

`backend-ia/app/services/matching_service.py` calculaba `1 - (re.embedding <-> :embedding) AS similarity` y ordenaba por el mismo operador. **En pgvector `<->` es distancia L2, no coseno**; el operador de distancia coseno es `<=>`.

Con embeddings normalizados (que es lo que produce `generate_embedding`), `1 - L2` no es la similitud coseno. Verificado contra la base real:

```sql
SELECT 1 - ('[1,0]'::vector <-> '[0.87,0.49315]'::vector) AS formula_vieja,
       1 - ('[1,0]'::vector <=> '[0.87,0.49315]'::vector) AS similitud_coseno;
-- formula_vieja = 0.4900   |   similitud_coseno = 0.8700
```

El POC (`docs/pocs/poc_similitudes.md`) midió ~0.85–0.89 de coseno para la misma mascota, y `SIMILARITY_THRESHOLD` es 0.75. O sea que el par que el sistema tiene que encontrar daba 0.49 y **quedaba sistemáticamente por debajo del umbral: no se creaba ni un solo match**.

Hay un segundo efecto, de performance: el índice está creado como `USING hnsw (embedding vector_cosine_ops)`, y ese operator family soporta **únicamente** `<=>`. Comprobado en la base:

```
 opfamily            | operador
---------------------+----------
 vector_cosine_ops   | <=>
 vector_l2_ops       | <->
```

Con `<->` la query nunca podía usar el índice y caía siempre en seq scan.

**Fix**: `<=>` en el `SELECT` y en el `ORDER BY`, con un comentario que explica por qué no se debe volver a `<->`. Se actualizaron también `docs/ARQUITECTURA.md` (sección 4.3), `backend-ia/README.md` y el comentario de `ReportEmbedding` en `schema.prisma`, que documentaban el operador equivocado.

### 2.2 [BUG] Los tests de matching no ejercían el umbral — Severidad: Alta — ✅ Corregido

`tests/test_matching_service.py` sembraba `EMBEDDING_A = [0.5] * 512` y le daba al candidato que debía matchear **el mismo vector exacto**. Dos vectores idénticos tienen distancia 0 en cualquier métrica, así que el test pasaba tanto con `<=>` como con `<->` y no distinguía uno del otro. El decoy de baja similitud (`[-0.5] * 512`, coseno -1) tampoco ejercía el umbral: fallaba por márgenes enormes en ambas métricas.

**Fix**: los fixtures ahora usan vectores unitarios construidos a un coseno exacto (`_unit_vector_at_cosine`), con los valores reales del POC — 0.87 para la misma mascota (debe matchear) y 0.65 para otra mascota (no debe matchear). Verificado que el test ahora sí guarda la regresión: revirtiendo el código a `<->` **fallan 3 tests**; con `<=>` pasan los 27.

### 2.3 [BUG] Reportes atascados en `pending` de forma permanente — Severidad: Alta — ✅ Corregido

Un reporte con imagen nace `pending` y solo sale de ahí cuando llega el veredicto del Backend IA. `triggerEmbeddingGeneration` reintenta 3 veces (1s + 5s + 30s ≈ 36s de presupuesto) y esos reintentos viven **en memoria del proceso de Node**. Si el Backend IA estuvo caído más que eso, o si el proceso de Node se reinició con la llamada en vuelo, nadie volvía a mirar ese reporte nunca: sin embedding, fuera del feed (que filtra por `published`) y sin poder matchear.

No es hipotético: al empezar esta verificación la base de desarrollo tenía **4 reportes con imagen atascados en `pending` desde el día anterior**, con `report_embeddings` y `report_matches` completamente vacías.

**Fix**: `reconcilePendingReports()` en `matching.service.ts`, llamada al arrancar el server y cada 5 minutos. Reencola los reportes `pending` con imagen que ya pasaron un grace period de 2 minutos (más largo que el presupuesto de reintentos, para no pisar una generación en curso) y siguen dentro de una ventana de 24 horas. Pasadas esas 24h se deja de insistir a propósito: si la imagen se borró del storage o la URL está rota, reintentar cada 5 minutos para siempre no lo arregla y solo genera carga. Esos casos quedan para revisión manual (la query está en `backend/README.md`).

### 2.4 [HALLAZGO] La autenticación interna es asimétrica — Severidad: Media — ⚠️ Documentado, no modificado

Las dos direcciones de la comunicación server-to-server validan `X-Internal-Key` con criterios opuestos cuando la variable no está configurada:

| Dirección | Implementación | Sin `INTERNAL_API_KEY` |
|---|---|---|
| Node → Backend IA | `verify_internal_key` (`backend-ia/app/main.py`) | **Falla abierto**: `if not settings.internal_api_key: return` — no valida nada |
| Backend IA → Node | `requireInternalKey` (`backend/src/middlewares/internal-auth.middleware.ts`) | Falla cerrado: `401` |

En desarrollo es cómodo, pero significa que si se despliega el Backend IA sin setear la variable, `POST /reports/{id}/embedding` queda abierto a cualquiera que alcance el servicio: se le puede quemar CPU con inferencias y escribir embeddings arbitrarios sobre reportes ajenos.

No se cambió en este PR porque cambiar el default rompería el setup local de todo el equipo (hoy ningún `.env` tiene la variable). **Recomendación**: hacer que el Backend IA falle cerrado cuando `NODE_ENV`/`ENV` no sea de desarrollo, en una issue aparte.

### 2.5 [HALLAZGO] Las notificaciones de match no se disparan en el entorno local — Severidad: Baja — ⚠️ Documentado

`matching_service._notify_match` avisa al Backend Principal para que notifique a los dueños de los dos reportes, pero solo si `NODE_BACKEND_URL` está seteada; si no, retorna sin hacer nada. Ese endpoint (`POST /api/notifications/internal/match`) además exige `INTERNAL_API_KEY`, que tampoco está en `backend/.env`.

Resultado: en el setup local actual **el match se persiste y se muestra en la UI, pero nadie recibe una notificación**. No está en el checklist de esta issue, pero conviene tenerlo presente para la issue de notificaciones.

### 2.6 [HALLAZGO] El umbral de 0.75 no está calibrado con fotos independientes de la misma mascota — Severidad: Baja — ⚠️ Documentado

Las similitudes medidas en esta verificación (sección 6) confirman que el umbral **no genera falsos positivos**: dos beagles distintos dan 0.59 y un beagle contra un pug da 0.45–0.55, todos bien lejos de 0.75. Lo que no se pudo verificar con fotos realmente independientes es el lado de los falsos negativos, porque el caso positivo se armó con dos recortes de una misma foto original (ver sección 6). El valor sigue siendo provisional, como ya dice `matching_service.py`. Para calibrarlo en serio hace falta un set de fotos distintas de la misma mascota.

### 2.7 [ENTORNO] `pip install torch` falla por el límite MAX_PATH de Windows — Severidad: Baja — ⚠️ Documentado

Instalar `requirements.txt` en un venv **dentro de la carpeta del proyecto** falla en Windows:

```
ERROR: Could not install packages due to an OSError: [WinError 206] El nombre del archivo
o la extensión es demasiado largo:
'...\Grupo1\backend-ia\.venv\Lib\site-packages\torch-2.13.0.dist-info\licenses\third_party\
kineto\libkineto\third_party\dynolog\third_party\prometheus-cpp\3rdparty\civetweb\examples\rest\cJSON'
```

La ruta del repo (`OneDrive\Escritorio\FACULTAD 5TO\Proyecto Final\Grupo1\`) ya consume ~105 caracteres y las rutas de licencias de torch suman ~155 más, pasándose de los 260 del `MAX_PATH` de Windows (`LongPathsEnabled = 0` en este equipo). El paquete queda igual funcional — falla al copiar archivos de licencia, después de instalar el código — y una segunda corrida de `pip install -r requirements.txt` completa el resto. Alternativas más limpias: habilitar `LongPathsEnabled` en el registro, o crear el venv fuera de OneDrive en una ruta corta.

---

## 3. Flujo completo verificado (camino feliz)

Corrido contra los tres servicios reales: Postgres en Docker (`5433`), Backend IA con **pesos reales de YOLOv8n y OpenCLIP ViT-B-32/laion2b_s34b_b79k** (`8000`), Backend Principal (`3001`) y frontend Vite (`5173`).

| # | Paso | Resultado |
|---|---|---|
| 1 | `POST /api/reports` con `imageUrl` | `201`, `status: "pending"`, respuesta inmediata (no espera la inferencia) |
| 2 | Backend dispara `POST /reports/{id}/embedding` en el Backend IA | Sin errores en el log de ninguno de los dos servicios |
| 3 | Backend IA descarga la imagen, corre YOLO y recorta la mascota | Detección correcta en las 5 imágenes con perro |
| 4 | Backend IA genera el embedding OpenCLIP y hace upsert en `report_embeddings` | 1 fila por reporte, `vector(512)` |
| 5 | Backend IA busca candidatos y persiste los que superan el umbral | Ver sección 6 |
| 6 | Backend responde `201` → marca el reporte `published` y sella `publishedAt` | Verificado vía `GET /api/reports/:id` |
| 7 | `GET /api/reports/:id/matches` | Devuelve los matches ordenados por similitud desc |
| 8 | UI de detalle del reporte | Muestra "Coincidencias sugeridas" con el porcentaje, 0 errores de consola |

---

## 4. Moderación de contenido (rama 422)

| Caso | Request | Esperado | Real | Estado |
|---|---|---|---|---|
| Imagen con perro | `POST /reports/{id}/embedding` | `201` | `201` en 0.61s | ✅ |
| Imagen sin mascota (patrón geométrico generado) | `POST /reports/{id}/embedding` | `422` | `422` — `"No se detectó una mascota en la imagen"` en 0.61s | ✅ |
| Imagen sin mascota, flujo completo por el Backend Principal | `POST /api/reports` | El reporte queda `rejected` | `pending → rejected` en **432ms** | ✅ |

---

## 5. Estado de `report_embeddings`

| Verificación | Resultado |
|---|---|
| Dimensión de la columna | `vector(512)` (migración `20260813000000_fix_report_embedding_dimension`) |
| Índice | `report_embeddings_embedding_idx` — `USING hnsw (embedding vector_cosine_ops)` |
| Una fila por reporte | `report_id` con constraint `UNIQUE`; el servicio hace `ON CONFLICT DO UPDATE` |
| Reprocesar el mismo reporte | 5 POSTs seguidos sobre el mismo `report_id` → `201` en todos, sin filas duplicadas |
| Embeddings normalizados | Sí, `generate_embedding` divide por la norma L2 |

---

## 6. Matching: similitudes reales medidas

Todos los reportes se crearon en el mismo punto (Plaza de Mayo, CABA) y el mismo día, para que ni el filtro de 5 km ni el de 30 días fueran el motivo de un no-match.

| Par | Coseno real (`<=>`) | Valor con la fórmula vieja (`<->`) | ¿Match? | Correcto |
|---|---|---|---|---|
| Misma mascota, dos tomas distintas | **0.8709** | 0.0974 | ✅ sí | ✅ |
| Misma mascota vs. la foto original | **0.8535** | — | ✅ sí | ✅ |
| Dos beagles **distintos** | 0.5926 | 0.0974 | ❌ no | ✅ |
| Beagle vs. pug | 0.5455 | 0.0466 | ❌ no | ✅ |
| Beagle (otro) vs. pug | 0.4530 | -0.0459 | ❌ no | ✅ |

El 0.87 medido cae exactamente en el rango que había predicho el POC para la misma mascota (0.85–0.89). **Ninguno de estos pares habría matcheado con la fórmula vieja**: el mejor caso daba 0.097 contra un umbral de 0.75.

Resultado de `GET /api/reports/{lost_id}/matches`, ordenado por similitud descendente:

```json
[
  { "reportId": 320, "reportType": "found", "similarityScore": 0.8708648681640625, "status": "pending" },
  { "reportId": 317, "reportType": "found", "similarityScore": 0.8534849453107998, "status": "pending" }
]
```

Filtros verificados en el mismo escenario: el reporte del **mismo tipo** (`found` vs `found`) quedó excluido correctamente, y la relación es simétrica — consultado desde el reporte `found` devuelve el `lost` con la misma similitud.

> **Limitación del caso positivo**: dog.ceo devuelve perros distintos, no dos fotos del mismo individuo. Para ejercer el caso positivo se generaron dos "tomas" de la misma mascota a partir de una foto real (recortes distintos, escalas distintas, un espejado y un cambio de brillo/saturación). Es suficiente para probar el camino completo query → umbral → `report_matches` → API → UI, pero no reemplaza una calibración con fotos independientes (ver hallazgo 2.6).

---

## 7. Performance

Medido sobre el Backend IA ya caliente (modelos cargados en memoria), CPU, sin GPU.

| Medición | Muestras | Resultado | Presupuesto |
|---|---|---|---|
| Inferencia pura (`POST /reports/{id}/embedding`: descarga + YOLO + OpenCLIP + upsert + matching) | 5 | 0.663 / 0.667 / 0.683 / 0.698 / 0.713 s → **~0.68s** | < 5s ✅ |
| End-to-end en caliente (crear reporte → `published`) | 4 | 868ms / 890ms / 1584ms / 2130ms | < 5s ✅ |
| End-to-end, primera imagen tras arrancar el servicio | 1 | 4747ms | < 5s ✅ (al límite) |
| Rechazo por moderación (end-to-end) | 1 | 432ms | < 5s ✅ |

La primera request después de levantar el servicio es notablemente más lenta (4.7s) por el warm-up de YOLO, y es el único valor que se acerca al límite de 5s. Los modelos se cargan a nivel de módulo, así que ese costo se paga una sola vez por proceso.

**Aparte**: la primera carga del servicio descarga ~610MB de pesos de OpenCLIP desde Hugging Face y ~6MB de YOLOv8n. En este equipo tardó unos 8 minutos. Es un costo de setup, no de request, pero conviene tenerlo en cuenta al desplegar.

---

## 8. Comportamiento ante una caída del Backend IA

| # | Escenario | Esperado | Real | Estado |
|---|---|---|---|---|
| 1 | Backend IA caído, se crea un reporte con imagen | El reporte queda `pending`, la creación **no** falla | `201` inmediato, `status: "pending"` | ✅ |
| 2 | Pasan los 3 reintentos (~36s) sin que el servicio vuelva | Sigue `pending`, **no** `rejected` | Sigue `pending` tras 50s | ✅ |
| 3 | Vuelve el Backend IA, corre el barrido periódico (5 min) | El reporte se rescata | `pending → published` | ✅ |
| 4 | Se reinicia el Backend Principal | El barrido corre al arrancar | `[matching] reencolados 2 reporte(s) atascados en pending` | ✅ |
| 5 | Reporte con URL de imagen muerta | Se reintenta pero sigue `pending`, sin romper nada | `respuesta inconclusa del Backend IA (status 500); queda en pending para revisión manual` | ✅ |
| 6 | Reporte `pending` de más de 24h | Se deja de reintentar | Excluido del barrido (2 de 4 quedaron fuera por antigüedad) | ✅ |

El punto 2 es importante y ya estaba bien resuelto antes de este PR (issue #125): una caída del Backend IA **no** es un veredicto de moderación, así que el reporte no se rechaza. Rechazarlo descartaría reportes legítimos de forma permanente y silenciosa.

Efecto secundario real observado durante la prueba: al levantar el backend con la reconciliación activa, dos de los cuatro reportes atascados de la base de desarrollo (169 y 171) se resolvieron a `rejected` — el Backend IA bajó sus imágenes reales de R2 y no encontró ninguna mascota en ellas. Es exactamente el comportamiento buscado. Los otros dos (168 y 170) tienen URLs muertas y quedaron en `pending`, para revisión manual.

---

## 9. Suites automatizadas

| Comando | Antes | Después |
|---|---|---|
| `backend`: `npx jest` | 220 passed, 19 suites | **223 passed**, 19 suites (3 tests nuevos de `reconcilePendingReports`) |
| `backend`: `npx tsc --noEmit` | ✅ | ✅ |
| `backend-ia`: `python -m pytest` | 27 passed | **27 passed** (fixtures de matching reescritos) |
| `frontend`: `npx tsc -b --noEmit` | ✅ | ✅ |
| `frontend`: `npx oxlint src` | ✅ | ✅ |

El warning `A worker process has failed to exit gracefully` en la suite del backend es **preexistente**: aparece igual corriendo el código original (verificado con `git stash`). No lo introduce este PR.

### Nota sobre aislamiento de los tests

Las suites del backend corren contra la base de desarrollo real, no contra una base efímera. `reconcilePendingReports()` barre **toda** la tabla `reports`, no solo las filas que siembra el test, así que un test suyo que deje `prisma.report.update` sin mockear y devuelva `201` desde el fetch mockeado **publica de verdad** cualquier reporte `pending` que la base tenga acumulado. Pasó durante esta verificación (se restauró el estado anterior). Los tests nuevos quedaron blindados contra eso:

- `prisma.report.update` se mockea en el `beforeEach` de todo el `describe` y no se des-mockea dentro de ningún test.
- Cuando un test necesita cambiar un status de verdad, lo hace por `$executeRaw`, que no está mockeado.
- Las aserciones son sobre los reportes sembrados por el test, nunca sobre totales globales.

---

## 10. Archivos tocados

| Archivo | Cambio |
|---|---|
| `backend-ia/app/services/matching_service.py` | `<->` → `<=>` en `SELECT` y `ORDER BY`, con el porqué documentado |
| `backend-ia/tests/test_matching_service.py` | Fixtures con cosenos reales del POC (0.87 / 0.65) en vez de vectores idénticos |
| `backend-ia/README.md` | Documenta el operador coseno y por qué no volver a `<->` |
| `backend/src/services/matching.service.ts` | `reconcilePendingReports()` y `startPendingReportsReconciliation()` |
| `backend/src/index.ts` | Arranca la reconciliación al levantar el server |
| `backend/tests/matching/matching.service.test.ts` | 3 tests de la reconciliación (ventana, grace period, sin imagen) |
| `backend/README.md` | Sección "Reportes atascados en `pending`" |
| `backend/prisma/schema.prisma` | Comentario de `ReportEmbedding` corregido (decía `<->`) |
| `docs/ARQUITECTURA.md` | Sección 4.3: query de matching corregida y explicada |

No se tocó el frontend: `ReportDetailPage` ya hace polling cada 3s mientras el reporte está `pending` (`useReportDetailQuery`) y `MatchCard` ya renderiza el porcentaje de similitud. Se verificó en el navegador y funciona.

---

## 11. Fuera de alcance / trabajo pendiente

- **Cola de procesamiento (Redis)**: hoy la inferencia es síncrona dentro de la request del Backend IA. Con un solo worker de uvicorn, varias imágenes concurrentes se serializan. Ya estaba anotado como pendiente en `backend-ia/README.md`.
- **Confirmar / rechazar un match desde el frontend**: `GET /api/reports/:id/matches` es de solo lectura; `report_matches.status` se queda en `pending`.
- **Notificaciones de match**: ver hallazgo 2.5.
- **Auth interna fail-closed en el Backend IA**: ver hallazgo 2.4.
- **Calibración del umbral con fotos independientes de la misma mascota**: ver hallazgo 2.6.
