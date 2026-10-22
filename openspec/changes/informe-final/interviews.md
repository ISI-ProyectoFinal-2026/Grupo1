# ADR interviews — informe-final

Raw record of the interviews with Matías Alvarado (PM), who answers for the whole team. Each entry keeps: the user's own answer (verbatim), the technical arguments proposed by the agent and the user's verdict on each (real motive vs. posterior justification), and the approved wording for the ADR. ADRs in `docs/adr/` are written only from entries marked **Aprobado**.

## Estado de las entrevistas (2026-10-22)

Entrevistas de Fase A completas: C01-C11, C13, C14, C16, C17 y CX01 están **Aprobado**. C12 y C15 siguen **En evaluación** y se cierran con los resultados del benchmark (slice 14, con un "Cierre" aprobado por el usuario). Las entradas que dicen "issue propuesto" corresponden a los issues ya creados:

| Entrada | Issue | Tema |
|---|---|---|
| C04 | #213 | Test de contrato de esquema entre Prisma y backend-ia |
| C05 | #214 | La inferencia de embeddings bloquea el event loop de FastAPI |
| C07 | #215 | JWT en cookie httpOnly |
| C09 | #216 | Política de uso de Nominatim |
| C14 | #217 | Parámetros del matching (ventana 90 días, umbral calibrado) |
| C16 | #218 | Ocultamiento automático por acumulación de denuncias |

---

## C01 — Monorepo y separación en dos backends

- **Fecha de entrevista:** 2026-10-21
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Matías Alvarado (PR #45, #46)
- **Respuesta del usuario (textual):** "elegimos un monorepo debido a tener mas orden, lo que es la estructura de separacion de carpetas se decidió hacer dos backends debido a que una parte del backend iba a ir dedicada solo a la parte de ia ya que tener un solo back que banque ia y lo demas del proyecto iba a ser muy pesado para bancarsela."
- **Argumentos técnicos propuestos — veredicto del usuario: todos son motivos reales del equipo:**
  - Monorepo: un único pipeline de CI (`.github/workflows/ci.yml`, 4 jobs); cambios entre servicios en una sola PR (clave interna: #109, #158); un único tablero de issues, `docs/` e historial.
  - Dos backends: el ecosistema de ML (ultralytics, open_clip, torch) es Python; la inferencia es intensiva en CPU (~0,68 s/imagen, `docs/QA_IA_PIPELINE.md`) y bloquearía el event loop de Node; aislamiento de fallas (si IA cae, los reportes quedan `pending`, PR #148); los modelos se cargan una vez en el servicio IA (`backend-ia/app/ml/pipeline.py`) sin ocupar memoria del backend principal (medición de RAM pendiente del benchmark).
  - Costo aceptado: repositorio más pesado; dos lenguajes y dos stacks de testing.
- **Redacción aprobada (Decisión):**
  > Se adopta un monorepo con paquetes `frontend/`, `backend/`, `backend-ia/`, `docker/` y `docs/` para centralizar el código, la integración continua, la documentación y la gestión de issues de un equipo de cuatro integrantes. El procesamiento de imágenes con IA se separa en un servicio propio porque las librerías de visión por computadora utilizadas (YOLO, OpenCLIP, PyTorch) pertenecen al ecosistema Python y porque la inferencia, intensiva en CPU, bloquearía el backend principal si se ejecutara en el mismo proceso.
- **Relación:** la separación en dos backends también alimenta C05 (servicio FastAPI separado); en C05 resta preguntar por qué FastAPI.

---

## C02 — Backend con Express 5 + TypeScript + Zod en capas

- **Fecha de entrevista:** 2026-10-21
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Franco Marín (PR #48)
- **Respuesta del usuario (textual):** "elegimos express porque nos parecio adecuado al tipo de aplicacion que estabamos haciendo" / "no evaluamos otras alternativas, si conociamos express pero no en su máx explendor"
- **Veredicto:** no hubo evaluación formal de alternativas; conocimiento previo de Express no avanzado. La comparación con NestJS/Fastify se registra como **análisis posterior**, y los beneficios técnicos como **validación posterior**.
- **Evidencia:** 9 de 10 controladores sin try/catch (Express 5 propaga errores async al `errorHandler`); helmet, express-rate-limit, cors; Socket.IO sobre el mismo servidor HTTP; supertest sobre `app` exportada (PR #48); Zod con `z.infer` (p. ej. `backend/src/validators/notifications.validator.ts`); auditoría 2026-09-23 sec. B.
- **Redacción aprobada:**
  > **Decisión:** Se adopta Express 5 con TypeScript y Zod, organizado en capas (rutas, controladores, servicios, validadores y middlewares).
  >
  > **Contexto y motivo:** La aplicación es una API REST de tamaño medio con comunicación en tiempo real, desarrollada por un equipo de cuatro integrantes en un plazo acotado. El equipo tenía conocimiento previo de Express, aunque no avanzado, y lo consideró adecuado para ese tipo de aplicación por su curva de aprendizaje baja y su amplio ecosistema de middlewares. No se realizó una evaluación formal de alternativas al momento de la decisión.
  >
  > **Validación posterior:** La versión 5 propaga automáticamente los errores de los controladores asíncronos al manejador central, por lo que 9 de 10 controladores no requieren try/catch. Los middlewares de seguridad (helmet, express-rate-limit, CORS) se integran de forma directa. Socket.IO comparte el servidor HTTP y supertest permite probar la aplicación sin levantar un puerto. Zod unifica validación en tiempo de ejecución y tipos de TypeScript.
  >
  > **Alternativas (análisis posterior):** NestJS habría impuesto una estructura y una curva de aprendizaje mayores. Fastify ofrece más rendimiento, pero con un ecosistema de middlewares más chico, y el volumen esperado no lo requiere.
  >
  > **Consecuencias:** La estructura en capas la define y la mantiene el equipo, ya que el framework no la impone.

---

## C03 — Una sola base: PostgreSQL 16 + PostGIS + pgvector

- **Fecha de entrevista:** 2026-10-21
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Gabriel Valdivieso (PR #47)
- **Respuesta del usuario (textual):** "por todo eso, todos fueron motivos reales" / sobre PG16: "vino con la imagen de postgis"
- **Veredicto:** todos los argumentos son motivos reales; la versión 16 fue heredada de la imagen base, sin evaluación explícita.
- **Evidencia:** consulta única en `backend-ia/app/services/matching_service.py` (`<=>` coseno + HNSW `vector_cosine_ops`, `ST_DWithin` 5 km, 30 días); `docs/ARQUITECTURA.md` (2026-08-06) listaba "Faiss o pgvector"; `docker/postgres/Dockerfile` (`postgis/postgis:16-3.4` → `postgres:16-bookworm`, ver C11).
- **Redacción aprobada:**
  > **Decisión:** Se utiliza una única base de datos PostgreSQL 16 con las extensiones PostGIS (datos geográficos) y pgvector (búsqueda vectorial), en lugar de un motor vectorial separado como Faiss.
  >
  > **Motivo:** La búsqueda de coincidencias combina en una sola consulta SQL la similitud visual (distancia coseno sobre embeddings, con índice HNSW), la distancia geográfica (`ST_DWithin`, 5 km), la antigüedad del reporte (30 días) y el tipo de reporte. Con un motor vectorial separado haría falta consultar dos sistemas, filtrar por ubicación y fecha después de la búsqueda vectorial (con riesgo de descartar todos los candidatos), y mantener sincronizados dos almacenamientos. Faiss, además, es una librería en memoria y no una base de datos, por lo que persistencia, respaldos y concurrencia quedarían a cargo del equipo. Una sola base simplifica también el despliegue, el CI y la gestión de migraciones con Prisma.
  >
  > **Versión:** PostgreSQL 16 no surgió de una evaluación explícita: es la versión incluida en la imagen `postgis/postgis:16-3.4` usada al inicio. Más adelante la imagen se reemplazó por `postgres:16-bookworm` con PostGIS y pgvector desde los repositorios oficiales de PostgreSQL, y la versión 16 se mantuvo (ver C11).
  >
  > **Consecuencias:** La búsqueda vectorial escala hasta lo que soporte una instancia de PostgreSQL con HNSW, suficiente para el volumen esperado. Si el volumen creciera órdenes de magnitud, habría que reevaluar un motor dedicado.

---

## C04 — Prisma 5 como ORM y única fuente de migraciones

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Gabriel Valdivieso (PR #47)
- **Respuesta del usuario (textual):** "nos pareció bueno por typescript y lo que oferece prisma." / "no evaluamos alternativas, en cuanto a otras alternativas y subir a prisma 7, el proyecto se encuentra en etapa de construcción aún asique siempre en cuanto a todo lo que forma la infraestrucutura y estructura y tecnologias del proyecto, si mejora en una canidad significante el rendimiento y la calidad del producto, la idea es saltar y dar el paso a migrar hacia otro sistema, tecnologia, etc."
- **Veredicto:** sin evaluación formal de alternativas. Prisma 7 no se adoptó porque no hubo evidencia de mejora significativa; aplica el criterio transversal de evolución tecnológica (ver CX01).
- **Evidencia:** `backend/prisma/schema.prisma` (`previewFeatures = ["postgresqlExtensions"]`, `Unsupported("geometry(Point, 4326)")`, `Unsupported("vector(512)")`); 14 migraciones; `$queryRaw/$executeRaw` en 7 archivos de `backend/src`; `backend-ia/app/models.py` (sin `create_all`); PRs de Dependabot de Prisma 7 / TS 7 (#87, #97, #84) cerradas sin merge.
- **Redacción aprobada:**
  > **Decisión:** Se adopta Prisma 5 como ORM del backend principal y como única fuente de migraciones del esquema.
  >
  > **Motivo:** El equipo eligió Prisma por su integración con TypeScript y sus funcionalidades: un cliente tipado generado desde el esquema (los cambios incompatibles se detectan en compilación), un esquema declarativo único que documenta el modelo de datos y migraciones SQL versionadas y reproducibles. No se realizó una evaluación formal de alternativas (TypeORM, Sequelize, Drizzle).
  >
  > **Versión:** No se migró a Prisma 7 porque no se identificó una mejora significativa de rendimiento o calidad que justificara un cambio de dos versiones mayores con incompatibilidades, conforme al criterio de evolución tecnológica del proyecto (ADR transversal).
  >
  > **Consecuencias:** Prisma no soporta de forma nativa los tipos `geometry` (PostGIS) ni `vector` (pgvector), que se declaran como `Unsupported` y se consultan con SQL crudo en 7 archivos. El backend IA mapea con SQLAlchemy un subconjunto de columnas sin migrar el esquema; la sincronización entre ambos mapeos no está verificada automáticamente (issue propuesto: test de contrato de esquema).

---

## CX01 — Criterio de evolución tecnológica (transversal)

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables:** Equipo (definido por Matías Alvarado, PM)
- **Respuesta del usuario (textual):** ver C04 — "si mejora en una canidad significante el rendimiento y la calidad del producto, la idea es saltar y dar el paso a migrar hacia otro sistema, tecnologia, etc." / sobre el criterio de 3 condiciones: "me sirve es exactamente lo que buscamos"
- **Redacción aprobada:**
  > **Decisión:** Mientras el sistema se encuentre en etapa de construcción, ninguna tecnología, componente de infraestructura o decisión estructural se considera definitiva. Se reemplaza cuando mejora de forma significativa el rendimiento o la calidad del producto.
  >
  > **Criterio de "mejora significativa":** no se fija un porcentaje único, porque el peso de una mejora depende de la métrica. Una migración se aprueba cuando se cumplen tres condiciones:
  > 1. **Mejora medida, no supuesta:** un benchmark o medición reproducible demuestra la mejora en una métrica relevante (precisión, latencia, consumo de memoria, seguridad o mantenibilidad).
  > 2. **Costo de migración estimado:** se estiman el esfuerzo, el riesgo de regresión y los componentes afectados, y la mejora compensa ese costo.
  > 3. **Registro formal:** la migración se documenta en un ADR nuevo que reemplaza al anterior e incluye las métricas previas y posteriores.
  >
  > **Consecuencias:** Las decisiones vigentes pueden revisarse sin que eso implique un error previo. Los hallazgos del benchmark de IA que contradigan las decisiones actuales se registran como issues y se evalúan con este criterio, sin modificar el sistema antes de contar con la medición y la estimación de costo.

---

## C05 — Servicio de IA con FastAPI

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Agustín Díaz (servicio, PR #56); Matías Alvarado (documento de arquitectura)
- **Respuesta del usuario (textual):** "fastAPI mas que nada por la facilidad de usarlo, por su rapidez y tiempo de respuesta" / "no evaluamos alternativas, todos fueron motivos reales"
- **Veredicto:** sin evaluación formal de alternativas. Motivos reales: facilidad de uso, modelo asíncrono, Pydantic, inyección de dependencias, OpenAPI automático, menor peso frente a Django (cuyo ORM chocaría con Prisma como dueño del esquema). La "rapidez" se acota: el framework aporta milisegundos frente a ~0,68 s de inferencia.
- **Evidencia:** `backend-ia/app/main.py` (`Depends`, `Security(APIKeyHeader)`, `BaseModel`, `lifespan`), `backend-ia/app/db.py` (`create_async_engine`, `AsyncSession`), `backend-ia/requirements.txt` (fastapi 0.115.0, uvicorn 0.52.3, pydantic 2.9.2, pydantic-settings 2.15.0), `docs/QA_IA_PIPELINE.md` §7; hallazgo: `embedding_service.py` sin `asyncio.to_thread` (issue propuesto).
- **Redacción aprobada:**
  > **Decisión:** El servicio de IA se implementa con FastAPI.
  >
  > **Motivo:** El equipo eligió FastAPI por su facilidad de uso y por su rendimiento. Su modelo asíncrono permite atender operaciones de entrada y salida (descarga de imágenes, consultas a la base con SQLAlchemy async) sin bloquear el servicio, y la validación con Pydantic, la inyección de dependencias (sesión de base y clave interna) y la documentación OpenAPI automática reducen el código necesario. Frente a Django, resulta más liviano para un servicio de cuatro endpoints y no incorpora un ORM con migraciones propias, que entraría en conflicto con Prisma como único dueño del esquema. No se realizó una evaluación formal de alternativas (Flask, Django).
  >
  > **Aclaración sobre el rendimiento:** El tiempo de respuesta del servicio está dominado por la inferencia de los modelos (≈0,68 s por imagen), no por el framework, cuyo costo por request es del orden de milisegundos. La latencia de cada modelo se mide en el benchmark.
  >
  > **Consecuencias:** La inferencia, intensiva en CPU, debe ejecutarse fuera del event loop para no bloquear el servicio. La moderación lo hace con `asyncio.to_thread`; el endpoint de embeddings todavía no (issue propuesto).

---

## C06 — Stack del frontend: React 19 + Vite + TypeScript + Tailwind 3 + React Router 6

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Gabriel Valdivieso (PR #102; revisión de Matías Alvarado)
- **Respuesta del usuario (textual):** "por estabilidad y documentación, y porque el equipo ya las conocía"
- **Evidencia:** `frontend/package.json` (react ^19.2.8, vite ^8.2.0, typescript ~6.0.2, tailwindcss ^3.4.19, react-router-dom ^6.30.6, oxlint, prettier); PR #102 (proxy `/api`, estructura de carpetas, Closes #61).
- **Redacción aprobada:**
  > **Decisión:** El frontend se implementa con React 19, Vite, TypeScript y Tailwind CSS 3, con React Router 6 para la navegación.
  >
  > **Motivo:** El equipo eligió estas tecnologías por su estabilidad, la disponibilidad de documentación y el conocimiento previo de sus integrantes. Por esas mismas razones se optó por Tailwind CSS 3 y React Router 6 aunque ya existían las versiones 4 y 7: las versiones adoptadas tenían más documentación y ejemplos disponibles, y el equipo ya sabía usarlas, lo que reducía el riesgo en un proyecto con plazo acotado.
  >
  > **Consecuencias:** Una migración futura a Tailwind 4 o React Router 7 se evaluará con el criterio de evolución tecnológica del proyecto (CX01), cuando exista una mejora medible que la justifique.

---

## C10 — Flujo de trabajo con Git: ramas personales + revisión obligatoria + Conventional Commits

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Matías Alvarado (PR #52, cierra #14)
- **Respuesta del usuario (textual):** sobre el revert: "sí, el revert fue para pasar por revisión" / "abandonamos develop ya que fue de prueba para ver si funcionaba bien el flujo, despues por persona nos pareció correcto ya que cada una de las personas verifica una funcionalidad y la hace y la sube desde su rama, en vez de tener miles de ramas creadas." / aprobó actualizar `docs/WORKFLOW.md` (merge del autor tras aprobación; ramas cortas por tarea permitidas).
- **Veredicto:** `develop` fue una prueba, no una decisión → se registra como Historial dentro de un único ADR (sin ADR reemplazado). Tarea derivada: actualizar `docs/WORKFLOW.md`.
- **Evidencia:** PR #45 y #47 desde `develop`; PR #52 y `docs/WORKFLOW.md`; PRs #99/#100/#101/#102; estadísticas de GitHub (Matías revisó 36 de 41 PRs del equipo; Agustín revisó 16 de Matías; Agustín mergeó 18 de sus 19 PRs); ramas por tarea `matias/fix-179-business-plan`, `matias/qa-141-chat-realtime`, `matias/feat-136-chat-notifications`.
- **Redacción aprobada:**
  > **Decisión:** Cada integrante trabaja en una rama personal permanente (`<nombre>/features`) desde la que abre pull requests hacia `main`. Toda integración requiere la revisión y aprobación de otro integrante, y los commits siguen la convención Conventional Commits.
  >
  > **Motivo:** Cada integrante desarrolla y verifica sus propias funcionalidades, por lo que una rama por persona refleja la organización del trabajo y evita la proliferación de ramas por funcionalidad. La revisión obligatoria asegura que todo cambio en `main` sea visto por al menos otra persona.
  >
  > **Historial:** Entre el 7 y el 10 de agosto se integró desde una rama `develop` (PR #45 y #47) para probar el flujo de trabajo. Una vez validado, el 12 de agosto se adoptó el esquema de ramas personales y se documentó en `docs/WORKFLOW.md` (PR #52, cierra #14).
  >
  > **Cumplimiento:** La revisión obligatoria se aplicó en la práctica. El setup inicial del frontend se integró sin revisión (#99, #100) y su propio autor lo revirtió el mismo día (#101) para volver a presentarlo por el flujo de revisión (#102, aprobado tras un pedido de cambios). Matías Alvarado revisó 36 de las 41 PRs del resto del equipo, y Agustín Díaz revisó 16 de las suyas.
  >
  > **Consecuencias:** Las ramas permanentes acumulan diferencias con `main`, lo que se mitiga sincronizándolas después de cada integración. En la práctica, cada autor integra su PR después de la aprobación, y se usan ramas cortas por tarea cuando conviene aislar un cambio. `docs/WORKFLOW.md` se actualiza para reflejarlo.

---

## C07 — Estado y datos en el frontend: TanStack Query + zustand + Axios

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Gabriel Valdivieso (#100, #102); Agustín Díaz (sesión persistida, #144)
- **Respuesta del usuario (textual):** "te soy sincero, no tengo idea porque ese stack, y respecto a lo otro salio x defecto" / "lo mejor sería verificar si esas tecnologias son adecuadas para este tipo de proyecto, si esto se adapta es lo mejor que hay, poner el por qué, caso contrario ver qué conviene"
- **Veredicto:** motivo original no documentado; se registra una **validación técnica posterior** (2026-10-22) que concluye que las tres librerías son adecuadas. JWT en localStorage: quedó por defecto → deuda técnica con issue propuesto.
- **Evidencia:** `frontend/src/hooks/useChatSocket.ts` (`setQueryData`/`invalidateQueries` desde eventos de Socket.IO); `frontend/src/hooks/useReportDetailQuery.ts` (`refetchInterval` condicional a `pending`); `frontend/src/hooks/useNotificationsQuery.ts` (polling 30 s); `frontend/src/services/api.ts` (interceptores; `useAuthStore.getState()` fuera de React; 401 cierra sesión, 403 no); `frontend/src/stores/auth.store.ts` (27 líneas, `persist`, clave `patitas-auth`); auditoría 2026-09-23 sec. G.
- **Redacción aprobada:**
  > **Decisión:** El frontend separa tres responsabilidades: TanStack Query para el estado del servidor, zustand para el estado del cliente (sesión) y Axios como cliente HTTP.
  >
  > **Motivo:** El motivo original de la elección no quedó documentado. En octubre de 2026 el equipo validó técnicamente que las tres librerías son adecuadas para el sistema: TanStack Query integra en una misma caché los datos de la API REST y los mensajes recibidos por Socket.IO, refresca automáticamente los reportes pendientes de verificación por IA y las notificaciones, e invalida solo los datos afectados por cada acción; zustand permite leer la sesión fuera de los componentes de React (lo requiere el interceptor HTTP) y persistirla con un middleware, algo que React Context no ofrece; Axios centraliza en interceptores el envío del token y el cierre de sesión ante respuestas 401. Frente a las alternativas, SWR ofrece menos soporte para mutaciones e invalidación, y Redux o RTK Query agregarían una complejidad innecesaria para un único estado de sesión.
  >
  > **Consecuencias:** El token de sesión se persiste en localStorage por defecto, lo que lo expone ante un eventual ataque XSS. Se registra como deuda técnica con issue propuesto (migración a cookie httpOnly, a evaluar según CX01). Las mitigaciones vigentes son la validación de sesiones contra la base con `token_version` y la limpieza de caché al cerrar sesión.

---

## C08 — Cloudflare R2 con subida directa mediante URLs prefirmadas

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Agustín Díaz (PR #54)
- **Respuesta del usuario (textual):** "por todo eso, todos fueron motivos reales"
- **Evidencia:** PR #54 ("el frontend suba directo a R2 sin pasar por el back"; key `pets/<uuid>.<ext>`, nunca el nombre original); `backend/src/services/storage.service.ts` (`PutObjectCommand` + `getSignedUrl`, 5 min; `isR2PublicUrl`); PR #148 (verificación de la respuesta de R2 en el frontend); precios oficiales https://developers.cloudflare.com/r2/pricing/ (sin egreso; free tier 10 GB-mes, 1M clase A, 10M clase B; consultado 2026-10-22). Corrección registrada: `HeadObjectCommand` se usa para la caché de flyers (`0530347`, 2026-09-28), no para verificar subidas.
- **Redacción aprobada:**
  > **Decisión:** Las imágenes se almacenan en Cloudflare R2 y el navegador las sube directamente mediante URLs prefirmadas (PUT, 5 minutos) que emite el backend.
  >
  > **Motivo:** R2 no cobra egreso (transferencia de salida), el costo que más crece en una aplicación donde cada imagen se visualiza muchas veces (feed, detalle, flyers, chat), mientras que Amazon S3 y Google Cloud Storage sí lo cobran. Su capa gratuita mensual (10 GB de almacenamiento, 1 millón de operaciones de escritura y 10 millones de lectura) cubre el piloto, y su compatibilidad con la API de S3 permite migrar sin cambiar el código. La subida directa evita que las imágenes (hasta 10 MB) atraviesen el backend, que solo firma la URL y valida el tipo, el tamaño y el nombre del objeto (`pets/<uuid>.<extensión>`, nunca el nombre original del archivo).
  >
  > **Consecuencias:** El backend valida que la URL de imagen de un reporte pertenezca a su bucket, pero no verifica que el objeto exista. Una subida fallida deja un reporte con una imagen inexistente, que el servicio de IA no puede procesar y que, por lo tanto, no llega a publicarse.

---

## C09 — Mapas con Leaflet + OpenStreetMap, geocodificación inversa con Nominatim, cercanía con PostGIS

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Gabriel Valdivieso (POC #4); Agustín Díaz (endpoints geo, PR #115); Matías Alvarado (UI de mapa, PR #146)
- **Respuesta del usuario (textual):** sobre Nominatim: "no sabemos, validalo vos"
- **Veredicto:** motivo de Leaflet+OSM documentado en la POC; Nominatim con validación técnica posterior (2026-10-22).
- **Evidencia:** `docs/pocs/poc_mapas` (comparativa Google Maps / Mapbox / Leaflet+OSM, decisión por costo, piloto San Rafael); `frontend/src/components/reports/LocationPicker.tsx` (llamada directa a `nominatim.openstreetmap.org/reverse`, con timeout); Google Maps Platform, cambios del 2025-03-01 (https://developers.google.com/maps/billing-and-pricing/march-2025); política de Nominatim (https://operations.osmfoundation.org/policies/nominatim/), consultadas 2026-10-22.
- **Redacción aprobada:**
  > **Decisión:** Los mapas se implementan con Leaflet y OpenStreetMap; la geocodificación inversa (coordenadas a dirección) usa el servicio público Nominatim, y las búsquedas por cercanía se resuelven en la base de datos con PostGIS (`ST_DWithin`).
  >
  > **Motivo (POC #4, documentado):** Se compararon Google Maps, Mapbox y Leaflet con OpenStreetMap. Google Maps y Mapbox requieren registrar un medio de pago, lo que representa un riesgo económico en un proyecto universitario. Leaflet con OpenStreetMap es de código abierto, no requiere claves comerciales y cubre los requisitos técnicos (marcar la ubicación de las mascotas y delimitar radios de cercanía) con una curva de aprendizaje baja. Al tratarse de un piloto acotado a San Rafael, se priorizó mitigar el riesgo económico.
  >
  > *Nota de actualización:* la POC menciona un crédito gratuito de Google Maps de USD 200 mensuales. Desde el 1 de marzo de 2025 ese crédito fue reemplazado por cupos gratuitos mensuales por API. La conclusión no cambia, porque el servicio sigue exigiendo una cuenta de facturación.
  >
  > **Geocodificación inversa (validación posterior):** Nominatim no formó parte de la POC y su elección no quedó documentada. En octubre de 2026 se validó que es adecuado para el piloto: es el geocodificador oficial de OpenStreetMap (las direcciones provienen de los mismos datos que el mapa), es gratuito y no requiere claves, en línea con el criterio de costo cero.
  >
  > **Consecuencias:** La política del servicio público de Nominatim limita el uso a 1 solicitud por segundo por aplicación (sumando todos los usuarios) y exige identificar la aplicación. Hoy cada navegador lo consulta directamente: alcanza para el piloto, pero no escala con muchos usuarios simultáneos (issue propuesto: proxy con caché o servicio propio, a evaluar según CX01).

---

## C11 — Imagen Docker de PostgreSQL: `postgres:16-bookworm` + PGDG (PostGIS, pgvector), puerto 5433

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Gabriel Valdivieso (`8f30a6c`, `918704a` 2026-08-09; `afd0d71` 2026-09-08, PR #165; #164 reemplazada)
- **Respuesta del usuario (textual):** "ok" (aprobó el borrador basado en el encabezado de `docker/postgres/Dockerfile`)
- **Evidencia:** encabezado de `docker/postgres/Dockerfile`; `docker-compose.yml` (puerto `${POSTGRES_PORT:-5433}:5432`, comentario sobre choque con Postgres local); PRs #164 y #165.
- **Redacción aprobada:**
  > **Decisión:** La base de datos se ejecuta en un contenedor construido desde la imagen oficial `postgres:16-bookworm` (Debian 12), con PostGIS y pgvector instalados desde el repositorio oficial de paquetes de PostgreSQL (PGDG). En el host se publica en el puerto 5433.
  >
  > **Historial:** La imagen inicial fue `postgis/postgis:16-3.4` (9 de agosto), que traía PostGIS preinstalado. El 8 de septiembre el CI empezó a fallar: todas las variantes de esa imagen para PostgreSQL 16 están construidas sobre Debian 11 (bullseye), que llegó al fin de su soporte. El índice de seguridad de esa versión expiró, y `apt-get update` lo rechaza con error.
  >
  > **Motivo del cambio:** Se migró a una base oficial sobre Debian 12, que corrige la construcción de forma definitiva. Se descartaron dos alternativas: la variante `16-3.5`, porque también está sobre bullseye, y desactivar la verificación de vencimiento de `apt`, porque dejaría la imagen sobre una distribución sin soporte ni actualizaciones de seguridad (PR #164, reemplazada por #165).
  >
  > **Puerto:** Se publica en el puerto 5433 del host para evitar conflictos con una instalación local de PostgreSQL en el puerto por defecto 5432.
  >
  > **Consecuencias:** La imagen ya no trae PostGIS preinstalado y se instala en la construcción; la versión de PostgreSQL (16) se mantuvo (ver C03). El `docker-compose` solo levanta la base de datos: los servicios de aplicación se ejecutan fuera de contenedores.

---

## C12 — Pipeline de IA para matching: YOLOv8n (recorte) + OpenCLIP ViT-B-32 laion2b (embedding)

- **Fecha de entrevista:** 2026-10-22
- **Estado:** En evaluación (se cierra con los resultados del benchmark)
- **Responsables (autoría de la decisión):** Agustín Díaz (POC #1 `docs/pocs/poc_similitudes.md`; implementación PR #56)
- **Respuesta del usuario (textual):** "esto es algo que se encuentra en evaluacion, estamos evaluando el funcionamiento de DINOv2 y hay que agregar que en este apartado se debe subir toda la verificacion de los modelos, incluyendo metricas de decision robustas" / "ok, apruebo las métricas y la regla"
- **Motivo original (POC, documentado):** opción B (YOLO recorta la mascota → OpenCLIP) elegida sobre A (OpenCLIP sobre la imagen completa) porque el fondo y otros elementos contaminan el embedding; resultados de la POC: misma mascota ~85–89 %, mascotas distintas ~65 %. Limitaciones reconocidas por la propia POC: muestra chica (cantidad de pares no registrada), no se evaluaron otros modelos; el notebook `POC_Similitudes.ipynb` citado por el código no está en el repositorio.
- **DINOv2:** sin rastro en ninguna rama, commit, issue ni PR (verificado 2026-10-22). Su evaluación es el benchmark de este cambio (`backend-ia/benchmarks/`), variante `vit_small_patch14_dinov2.lvd142m` vía timm (ver design.md).
- **Métricas de decisión aprobadas:**
  - Calidad: AUC-ROC con IC 95 % (bootstrap); TAR@FAR=1 %; EER; Top-1 y Top-5; precisión y recall con el umbral vigente 0,75 y umbral óptimo según los datos; tasa de detección de YOLO.
  - Costo: latencia por imagen en CPU (mediana y p95), memoria máxima, tamaño del modelo.
- **Regla de decisión aprobada:** una alternativa (DINOv2 u OpenCLIP solo) reemplaza al pipeline vigente solo si (1) lo supera en AUC o en TAR@FAR=1 % con intervalos de confianza que no se superponen; (2) mantiene el matching por debajo de **5 s (p95)**, requisito no funcional del PDD v1.0; (3) pasa por el registro formal de CX01. Si no cumple, se mantiene YOLO + OpenCLIP con la evidencia de la comparación.
- **Aclaración de requisitos:** el PDD v1.0 fija "Matching de imágenes: < 5 segundos por solicitud (p95)" y "Tiempo de respuesta API: < 500 ms (p95) con 200 usuarios concurrentes". La PR #56 citó "< 0.5 s" para el backend-ia, confundiendo ambos. `docs/QA_IA_PIPELINE.md` midió ~0,68 s de inferencia y 0,87–1,6 s end-to-end contra el presupuesto correcto de 5 s.
- **Tamaño de los modelos (respuesta textual):** "para correr en cpu sin gpu claro, podría expandirse pero aumentarian los recursos que necesitamos"
- **Redacción aprobada (tamaño):**
  > **Tamaño de los modelos:** Se eligieron las variantes livianas, YOLOv8n (*nano*, la más chica de YOLOv8) y OpenCLIP ViT-B-32, para que el servicio funcione en CPU, sin GPU. ViT-B-32 divide la imagen en parches de 32 píxeles: a 224 px son 49 parches, contra 196 de la variante B-16, lo que reduce varias veces el costo de cómputo. Las variantes más grandes podrían mejorar la precisión, pero aumentarían los recursos de infraestructura necesarios. El benchmark mide la latencia, la memoria y el tamaño de cada variante.
- **Notebook de la POC:** según el usuario, Agustín Díaz lo tiene en su máquina (2026-10-22). Tarea: pedirle que lo suba a `docs/pocs/POC_Similitudes.ipynb` (hoy citado por `backend-ia/app/ml/pipeline.py`, `backend-ia/requirements.txt` y la migración `20260813000000_fix_report_embedding_dimension`, pero ausente del repositorio).

---

> **FORMATO DE ADR (aprobado 2026-10-22, aplica a todos los ADR, incluidos C01–C12 al pasarlos a `docs/adr/`):** Decisión (1–2 líneas) · Motivo (2–4 viñetas, al grano) · Alternativas (1 línea) · Consecuencias (1–3 viñetas) · Referencias (una línea con links a PR/issue/benchmark). Sin fechas en el cuerpo, sin nombres de archivos ni código salvo que sean la decisión misma. El contenido aprobado de cada entrada se mantiene; solo se condensa.

---

## C13 — Dimensión del embedding: 512

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Agustín Díaz (corrección, commit `3873b38`); especificación inicial de 1536 en el documento de arquitectura (Matías Alvarado, `d58c06e`) seguida por el esquema inicial (Gabriel Valdivieso, `8f30a6c`)
- **Respuesta del usuario (textual):** "la verdad no tengo idea de esa parte, habria que sacar conclusiones y ver cual es la mejor y certera"
- **Conclusiones verificadas en git:** el 1536 provino de `docs/ARQUITECTURA.md` original; la corrección (20:59) es anterior al código que genera e inserta embeddings (21:04 en adelante), la tabla no tenía filas. Hipótesis de OpenAI ada-002 descartada del ADR por no ser comprobable.
- **Redacción aprobada:**
  > **Decisión:** Los embeddings se almacenan con 512 dimensiones, la salida del modelo OpenCLIP ViT-B-32.
  >
  > **Motivo:**
  > - La especificación inicial preveía 1536 dimensiones, antes de elegir la variante del modelo.
  > - Al implementar la generación de embeddings se detectó la diferencia y se corrigió el esquema antes de almacenar datos.
  >
  > **Consecuencias:**
  > - La dimensión queda atada al modelo: cambiarlo exige migrar la columna, el índice y los embeddings existentes, un costo a considerar según el criterio de evolución tecnológica.
  >
  > **Referencias:** issue #18, PR #56.

---

## C14 — Parámetros del matching: coseno, umbral, radio, ventana temporal, top-5, confirmación manual

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado (umbral: en evaluación hasta el benchmark)
- **Responsables (autoría de la decisión):** Agustín Díaz (implementación original, PR #56); Gabriel Valdivieso (corrección L2 → coseno, PR #156); Matías Alvarado (confirmación/rechazo, PR #192)
- **Respuesta del usuario (textual):** "esto está sujeto a encontrar valores que tengan lógica, asique es generico y habria que ajustarlo, corregir" / aprobó la propuesta: "ok"
- **Veredicto:** valores provisionales. Umbral 0,75 → se calibra con el benchmark. Radio 5 km → se mantiene (respaldado por literatura). Ventana 30 días → propuesta de ampliar a 90 días vía issue (CX01). Sin cambios de código antes de la revisión.
- **Evidencia:** `docs/QA_IA_PIPELINE.md` §2.1/2.6 (la fórmula L2 daba 0,49 para un par de 0,87); Huang et al. (2018), Animals 8(1):5, https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5789300/ (75 % de los gatos hallados a menos de 500 m; con acceso exterior hasta ~1,6 km); Lord et al. (2007), JAVMA 230(2):217-220, https://pubmed.ncbi.nlm.nih.gov/17223754/ (138 gatos; mediana de recuperación 5 días, rango 0,5–81; mayoría a menos de 1 milla). Sin dato revisado por pares de distancia para perros (limitación declarada).
- **Redacción aprobada:**
  > **Decisión:** Se sugiere una coincidencia cuando la similitud coseno entre embeddings supera un umbral, la otra mascota se reportó a menos de 5 km, el reporte es reciente y de tipo opuesto (perdida/encontrada). Se muestran las 5 mejores y el dueño confirma manualmente.
  >
  > **Motivo:**
  > - La distancia coseno es la métrica adecuada para embeddings normalizados y la que usa el índice vectorial; la distancia euclídea usada inicialmente subestimaba la similitud.
  > - El radio de 5 km cubre con margen la distancia a la que suelen aparecer las mascotas perdidas según estudios publicados (la mayoría a menos de 1,6 km).
  > - La confirmación manual evita que un falso positivo resuelva un reporte.
  >
  > **Consecuencias:**
  > - El umbral (0,75) y la ventana temporal (30 días) son provisionales: el umbral se calibra con el benchmark y se propone ampliar la ventana a 90 días, ya que hay mascotas que se recuperan hasta casi tres meses después.
  > - No hay datos publicados de distancia para perros; el radio se revisará con datos del piloto.
  >
  > **Referencias:** PR #56, PR #156, PR #192; Huang et al. (2018); Lord et al. (2007); benchmark de matching.

---

## C15 — Moderación de imágenes: "¿contiene un animal real?"

- **Fecha de entrevista:** 2026-10-22
- **Estado:** En evaluación (se cierra con el benchmark de moderación)
- **Responsables (autoría de la decisión):** Franco Marín (POC #3, eligió CLIP); Agustín Díaz (implementación con YOLO, PR #58); Gabriel Valdivieso (pre-chequeo síncrono y criterio único, PR #195)
- **Respuesta del usuario (textual):** "yolo funcionaba mejor que openclip en cuanto a todo eso, fijate, se que tenemos alguna documentacion que lo respalda con datos y metricas reales" / aprobó la propuesta: "excelente"
- **Verificación (2026-10-22):** búsqueda en todo el repo, las 15 ramas, PRs #58 y #195, issues #3 y #19 y búsqueda en GitHub: no existe documentación que muestre que YOLO supera a CLIP en moderación. `docs/pocs/poc_moderacion` concluye lo contrario (YOLOv8/COCO no detecta tortugas, conejos; CLIP es "el enfoque final"), sin registrar el % de aciertos del notebook de Colab. Issue #3 exigía 90–99 % de precisión y quedó tildado sin el dato. Probable confusión con la POC de similitudes (YOLO + OpenCLIP > OpenCLIP solo para matching, no para moderación).
- **Decisión de proceso aprobada:**
  1. Pedir a Franco Marín el notebook de Colab de la POC de moderación (evidencia original con % de aciertos).
  2. El benchmark compara YOLOv8n (10 clases animales COCO, criterio de producción) contra CLIP zero-shot sobre 440 imágenes (incluye 40 conejos, 40 tortugas, 59 peluches, 41 representaciones).
  3. Métricas: recall por clase de animal real, tasa de falsa aceptación en `no_animal` (en especial peluches y representaciones), exactitud balanceada, matriz de confusión, IC 95 % por bootstrap, latencia p95.
  4. Regla de decisión análoga a C12 + CX01: se reemplaza el criterio vigente solo si la alternativa mejora con intervalos de confianza que no se superponen, respeta el requisito de < 5 s (p95) y pasa por el registro formal de CX01.
- **Hecho verificado en código:** las 10 clases de `_ANIMAL_LABELS` (bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe) no incluyen conejo ni tortuga: hoy esas mascotas se rechazan.

---

## C16 — Moderación híbrida: filtro automático por IA + denuncias de usuarios

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Franco Marín (denuncias, PR #57); Agustín Díaz (estado `pending` hasta moderación IA, PR #58; visibilidad solo para el dueño, PR #191); Matías Alvarado (roles y moderación accionable, PR #193); Gabriel Valdivieso (panel de moderación, PR #195)
- **Respuesta del usuario (textual):** "claro es exactamente por eso, en caso de que la IA no detecte, dejamos a los usuarios que puedan denunciar algun reporte que se haga que no tenga nada que ver con el ecosistema de animales, y mediante moderacion que la idea es que no sea manual, se elimine. Ahora que lo pienso esa moderacion se podría hacer automatica que si una publicacion/reporte llega a un mínimo de denuncias por x motivo, se elimine..." / aprobó ocultar (no eliminar): "okai"
- **Evidencia:** issue #19 ("vía de escape a moderación manual"); `backend/prisma/schema.prisma` `ReportFlag` (`@@unique([reportId, userId])`, `reason` texto libre).
- **Redacción aprobada:**
  > **Decisión:** La moderación combina un filtro automático por IA al publicar con denuncias de usuarios resueltas por moderadores.
  >
  > **Motivo:**
  > - La IA filtra en volumen y sin costo humano, pero no detecta todo el contenido fuera de lugar.
  > - Las denuncias de la comunidad cubren lo que la IA no detecta.
  > - Un reporte no visible para el público (pendiente o rechazado) solo lo ve su dueño.
  >
  > **Consecuencias:**
  > - Hoy la resolución de denuncias es manual. Se propone ocultar automáticamente un reporte al alcanzar un mínimo de denuncias de usuarios verificados, con revisión final de un moderador.
  >
  > **Referencias:** issue #19, PR #57, PR #58, PR #191, PR #193, PR #195.

---

## C17 — Flyers: plantilla fija dibujada con `@napi-rs/canvas` (PNG 1080×1920)

- **Fecha de entrevista:** 2026-10-22
- **Estado:** Aprobado
- **Responsables (autoría de la decisión):** Matías Alvarado (POC de flyers); Agustín Díaz (implementación, PR #159; flyer propio, PR #166); Matías Alvarado (caché y rate limit, PR #192)
- **Respuesta del usuario (textual):** "creeria q si, pero validalo vos plis" / "ok"
- **Veredicto:** motivo plantilla vs IA generativa documentado en la POC; cambio de Jinja2+Playwright a canvas en Node con validación técnica posterior (2026-10-22).
- **Evidencia:** `docs/pocs/poc_flyers.md`; `backend/src/services/flyer.service.ts` (1080×1920, `createCanvas`); `@napi-rs/canvas` (binding de Skia, binarios precompilados sin dependencias del sistema, etiquetado pre-release: https://napi.rs/docs/ecosystem/@napi-rs/canvas); 37 MB instalado (win32-x64); formato 9:16 1080×1920 para historias (https://www.inro.social/blog/instagram-story-size, fuente secundaria).
- **Redacción aprobada:**
  > **Decisión:** Los flyers se generan automáticamente a partir de una plantilla fija, dibujada como imagen PNG de 1080×1920 con `@napi-rs/canvas` en el backend principal.
  >
  > **Motivo:**
  > - Plantilla en vez de IA generativa: la IA inventa datos (como el teléfono) y deforma la foto; un flyer de mascota perdida exige precisión (POC).
  > - Canvas en Node en vez de la plantilla HTML con Jinja2 y Playwright de la POC: se genera en el mismo servicio que tiene los datos y sin ejecutar un navegador completo, con binarios precompilados y sin dependencias del sistema (validación posterior).
  > - 1080×1920 (9:16) es el formato vertical de las historias de Instagram y los estados de WhatsApp, donde se comparten los flyers.
  >
  > **Consecuencias:**
  > - La librería todavía está en etapa pre-release; el riesgo se acota porque cada flyer se genera una vez y se cachea.
  >
  > **Referencias:** POC de flyers, PR #159, PR #166, PR #192.
