# Issue drafts — informe-final

Drafts only. Issues are created on GitHub after the user approves them. Labels follow the repo convention (`type:`, `epic:`, `priority:`, `area:`).

---

## [CHORE] Test de contrato de esquema entre Prisma y backend-ia

- **Origen:** entrevista C04 (2026-10-22).
- **Labels sugeridos:** `type: chore`, `epic: infra`, `priority: low`, `area: backend`
- **Descripción:** Prisma es el único dueño del esquema (`backend/prisma/schema.prisma`, 14 migraciones). El backend IA mapea un subconjunto de columnas con SQLAlchemy (`backend-ia/app/models.py`: `reports` y `report_embeddings`) sin generar migraciones, y escribe `report_matches` con SQL crudo. Hoy ambos coinciden, pero nada verifica automáticamente que el espejo siga sincronizado: un cambio de nombre o tipo de columna en Prisma rompería el backend IA recién en ejecución. `backend-ia/tests/test_db_connection.py` solo verifica que las tablas existan.
- **Propuesta:** agregar al job `backend-ia` del CI un test que, sobre la base migrada por Prisma, compare cada columna mapeada en `models.py` (y las usadas por SQL crudo en `matching_service.py`) contra `information_schema.columns` (nombre y tipo compatible).
- **Criterio de aceptación:** el CI falla si una columna mapeada por backend-ia no existe o cambió de tipo en la base migrada.

---

## [BUG] La inferencia de embeddings bloquea el event loop de FastAPI

- **Origen:** recolección de evidencia para C05 (2026-10-22).
- **Labels sugeridos:** `type: bug`, `epic: infra`, `priority: medium`, `area: backend`
- **Descripción:** `backend-ia/app/services/embedding_service.py` (`process_report_image`, `async def`) invoca `detect_and_crop` y `generate_embedding` de forma síncrona. Esas llamadas son inferencia intensiva en CPU (~0,68 s por imagen según `docs/QA_IA_PIPELINE.md`) y bloquean el event loop mientras duran: las demás requests concurrentes (`/health`, `/images/analyze`, otros embeddings) quedan en espera. `backend-ia/app/services/image_analysis_service.py` ya resuelve el mismo caso con `asyncio.to_thread`.
- **Propuesta:** ejecutar la inferencia de `process_report_image` con `asyncio.to_thread` (mismo patrón que `image_analysis_service`) y cubrirlo con un test.
- **Criterio de aceptación:** durante el procesamiento de un embedding, `/health` responde sin esperar a que termine la inferencia.
- **Relación:** el test de carga (#40) haría visible el problema.

---

## [REFACTOR] Mover el JWT de localStorage a una cookie httpOnly

- **Origen:** entrevista C07 (2026-10-22); auditoría `docs/AUDITORIA_INTEGRAL_BACKEND_2026-09-23.md` sec. G.
- **Labels sugeridos:** `type: refactor`, `epic: seguridad`, `priority: low`, `area: frontend`, `area: backend`
- **Descripción:** El token de sesión se persiste en `localStorage` (`frontend/src/stores/auth.store.ts`, clave `patitas-auth`) y se envía como `Bearer` desde el interceptor de Axios (`frontend/src/services/api.ts`). No fue una decisión explícita: quedó así por defecto. Cualquier script inyectado (XSS) puede leerlo. Mitigaciones actuales: sesiones validadas contra la base con `token_version` (#204), limpieza de caché en logout (#175), escape por defecto de React.
- **Propuesta:** evaluar con el criterio de evolución tecnológica (CX01) el paso a cookie `httpOnly` + `Secure` + `SameSite`, lo que implica protección CSRF, CORS con credenciales y adaptar el handshake JWT de Socket.IO.
- **Criterio de aceptación:** el token no es accesible desde JavaScript del navegador y los flujos de login, chat en tiempo real y logout siguen funcionando (tests e2e).

---

## [CHORE] Geocodificación inversa: cumplir la política de uso de Nominatim y preparar el escalado

- **Origen:** entrevista C09 (2026-10-22).
- **Labels sugeridos:** `type: chore`, `epic: geolocalización`, `priority: low`, `area: frontend`, `area: backend`
- **Descripción:** `frontend/src/components/reports/LocationPicker.tsx` consulta `https://nominatim.openstreetmap.org/reverse` directamente desde el navegador de cada usuario. La política oficial (https://operations.osmfoundation.org/policies/nominatim/) fija un máximo absoluto de 1 request por segundo **por aplicación** (sumando todos sus usuarios) y exige identificar la aplicación con Referer o User-Agent válido. Para el piloto es suficiente; con usuarios concurrentes el sistema podría superar el límite y ser bloqueado.
- **Propuesta:** evaluar con el criterio CX01: (a) proxy en el backend con caché por coordenadas redondeadas y rate limit global, identificando la aplicación; (b) instancia propia de Nominatim; (c) proveedor pago.
- **Criterio de aceptación:** las consultas de geocodificación inversa respetan el límite de 1 req/s por aplicación y se identifican conforme a la política.

---

## [FEATURE] Ajustar los parámetros del matching con evidencia (ventana 90 días, umbral calibrado)

- **Origen:** entrevista C14 (2026-10-22).
- **Labels sugeridos:** `type: story`, `epic: matching`, `priority: medium`, `area: backend`
- **Descripción:** Los parámetros del matching (`backend-ia/app/services/matching_service.py`: umbral 0,75, radio 5 km, ventana 30 días, top 5) son provisionales. Lord et al. (2007, JAVMA) reporta recuperaciones de hasta 81 días; con 30 días se pierden coincidencias tardías. El umbral 0,75 nunca se calibró con datos.
- **Propuesta:** (1) ampliar la ventana a 90 días; (2) fijar el umbral según el benchmark (`backend-ia/benchmarks/`, umbral óptimo y TAR@FAR=1 %); (3) llevar los parámetros a configuración para ajustarlos con datos del piloto sin tocar código. Evaluar según CX01.
- **Criterio de aceptación:** los parámetros se leen de configuración, la ventana es de 90 días y el umbral coincide con el valor justificado por el benchmark.

---

## [FEATURE] Ocultamiento automático de reportes por acumulación de denuncias

- **Origen:** entrevista C16 (2026-10-22), propuesta del PM.
- **Labels sugeridos:** `type: story`, `epic: moderación`, `priority: medium`, `area: backend`, `area: frontend`
- **Descripción:** Hoy cada denuncia (`ReportFlag`, una por usuario y reporte) la resuelve un moderador a mano. Se busca que la moderación sea mayormente automática sin permitir que un grupo de usuarios baje reportes legítimos.
- **Propuesta:**
  1. Tipificar los motivos de denuncia (hoy `reason` es texto libre): p. ej. "no es un animal", "contenido ofensivo", "spam", "duplicado".
  2. Al alcanzar N denuncias de usuarios distintos con email verificado por el mismo motivo, el reporte pasa a un estado oculto (no se elimina).
  3. El reporte oculto entra a la cola del moderador y se notifica al dueño.
  4. Reversible: si el moderador lo considera válido, vuelve a publicarse. N configurable.
- **Criterio de aceptación:** con N denuncias verificadas del mismo motivo el reporte deja de verse en el feed, aparece en la cola de moderación con su motivo, el dueño recibe una notificación y el moderador puede restaurarlo.

---

## Creados en GitHub (2026-10-22, aprobados por el usuario)

| Issue | Borrador | Prioridad propuesta (campo Priority del Project) |
|---|---|---|
| #213 | [CHORE] Test de contrato de esquema entre Prisma y backend-ia | Low |
| #214 | [BUG] La inferencia de embeddings bloquea el event loop de FastAPI | Medium |
| #215 | [REFACTOR] Mover el JWT de localStorage a una cookie httpOnly | Low |
| #216 | [CHORE] Geocodificación inversa: política de uso de Nominatim | Low |
| #217 | [FEATURE] Ajustar los parámetros del matching (ventana 90 días, umbral calibrado) | Medium |
| #218 | [FEATURE] Ocultamiento automático de reportes por acumulación de denuncias | Medium |

Todos agregados a "Patitas-Project-G1" en Status = Backlog. El campo Priority del Project no tiene opciones configuradas (pendiente).
