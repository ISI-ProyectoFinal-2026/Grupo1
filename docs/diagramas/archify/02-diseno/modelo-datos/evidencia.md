# Evidencia — D-07 Modelo de datos (ERD)

| Dato | Valor |
| --- | --- |
| Diagrama | `modelo-datos.html` (fuente `candidate.json`) |
| Tipo Archify | `erd`, perfil de calidad `standard` (esquema denso: 18 tablas, 152 columnas) |
| Commit de las fuentes | `f518b9aa75150d547f5dee742083ef29089b769b` |
| Fecha de generación | 2026-11-02 |
| Validación | `finalize` aprobado en la 4.ª ejecución: `validate`, `deliver`, `check`, `browser-check` (`review-2/modelo-datos.finalize.json`). `modelo-datos.finalize.json` en la raíz de la carpeta corresponde a la 3.ª ejecución, fallida en `browser-check` |
| Capturas | `visual-check/` (1440×900 y 2048×1320, tema claro y oscuro) |
| Sección del informe | 1.2.4 |

## Ejecuciones

| N.º | Resultado | Diagnóstico | Corrección |
| --- | --- | --- | --- |
| 1 | `fallida` en `validate` | `erd/attribute-text-capacity` en `users` y `businesses` | Ancho de `users` 330 y `businesses` 260 |
| 2 | `fallida` en `validate` | `erd/attribute-text-capacity` en `notification_preferences`, `reports`, `report_matches` | Anchos 380, 246 y 290 |
| 3 | `fallida` en `browser-check` | `viewer/viewport-overflow` y `viewer/projected-text-readability`: lienzo de seis columnas demasiado ancho | Seis dominios reagrupados en cuatro columnas (dos columnas con dos dominios apilados); `gapX` 96 → 80 |
| 4 | `aprobada` | Sin diagnósticos. Recomendación no bloqueante: 4 rutas con más quiebres que los sugeridos | Ninguna |

## Fuentes

| Fuente | Contenido usado |
| --- | --- |
| `backend/prisma/migrations/*/migration.sql` (23 migraciones, `20260809000000_init` a `20261101040000_add_ad_flags`) | Esquema efectivo: tablas, columnas, tipos SQL, PK, FK con `ON DELETE`, UNIQUE, índices, tipos enumerados |
| `backend/prisma/schema.prisma:1-522` | Contraste del esquema declarado con el efectivo |
| `backend-ia/app/models.py:14-38` | Contraste con el ORM SQLAlchemy del Backend IA |
| `backend-ia/app/services/embedding_service.py:45-51`; `backend-ia/app/services/matching_service.py:80-160` | Escritura de `report_embeddings` (ORM) y de `report_matches` (SQL crudo) desde el Backend IA |

## Verificación por tabla

| Tabla | Dominio | Columnas | Migraciones que la definen o alteran | schema.prisma |
| --- | --- | --- | --- | --- |
| `users` | Identidad y seguridad | 16 | `20260809000000_init:17-27`, `:123`; `20260928010000_add_user_role:5`; `20260928020000_email_verification_and_auth_tokens:5-6`; `20261013000000_two_factor_auth:7-12` | `:26-67` |
| `auth_tokens` | Identidad y seguridad | 7 | `20260928020000_email_verification_and_auth_tokens:9-28`; enum ampliado en `20261013000000_two_factor_auth:2-4` | `:82-95` |
| `two_factor_recovery_codes` | Identidad y seguridad | 5 | `20261013000000_two_factor_auth:15-29` | `:99-110` |
| `pets` | Mascotas y reportes | 11 | `20260809000000_init:30-42`, `:150`; `20260811220000_add_pet_color_and_photos:1-6` | `:112-129` |
| `reports` | Mascotas y reportes | 14 | `20260809000000_init:45-61`, `:126-132`, `:153-156`; `20260908000000_add_report_custom_flyer_url:1-3` | `:147-178` |
| `report_flags` | Mascotas y reportes | 6 | `20260814220000_add_report_flags:5-29`; `20261029000000_cascade_report_dependents:10-11`, `:22-23` | `:187-202` |
| `report_embeddings` | Matching por IA | 4 | `20260809000000_init:64-71`, `:135-138`; `20260813000000_fix_report_embedding_dimension:5-7`; `20261014000000_dinov2_embedding_dimension:8-11`; `20261029000000_cascade_report_dependents:1-2`, `:13-14` | `:204-216` |
| `report_matches` | Matching por IA | 7 | `20260809000000_init:74-84`, `:141-144`; `20260809010000_add_chat_unique_and_report_match_index:5`; `20261029000000_cascade_report_dependents:4-8`, `:16-20` | `:226-242` |
| `chats` | Comunicación y notificaciones | 5 | `20260809000000_init:87-95`, `:168-174`; `20260809010000_add_chat_unique_and_report_match_index:2` (UNIQUE reemplazado); `20260928000000_chat_unique_per_report:7`, `:40` | `:244-264` |
| `messages` | Comunicación y notificaciones | 6 | `20260809000000_init:98-106`, `:177-180`; `20260902000000_add_message_image_url:1-3` | `:266-278` |
| `notifications` | Comunicación y notificaciones | 8 | `20260809000000_init:109-120`, `:147`, `:183-186` | `:280-295` |
| `notification_preferences` | Comunicación y notificaciones | 13 | `20261028000000_add_notification_preferences:8-30` | `:315-335` |
| `businesses` | Comercios y plan Premium | 15 | `20260820120000_add_business_model:8-30`; `20261027000000_add_business_location:1-3`; `20261101000000_premium_subscriptions:1-10`; `20261101010000_business_profile_links:1-4` | `:388-413` |
| `business_events` | Comercios y plan Premium | 5 | `20260907000000_add_business_events:5-22` | `:509-522` |
| `subscriptions` | Comercios y plan Premium | 10 | `20261101000000_premium_subscriptions:19-38` | `:370-386` |
| `ads` | Publicidad | 9 | `20261101020000_add_ads:5-23` | `:425-442` |
| `ad_flags` | Publicidad | 6 | `20261101040000_add_ad_flags:5-26` | `:454-468` |
| `ad_events` | Publicidad | 5 | `20261101030000_add_ad_events:8-22` | `:486-497` |

Total: 18 tablas, 152 columnas, 26 relaciones (FK). Cardinalidad 1:1 solo en `businesses.user_id` (UNIQUE), `report_embeddings.report_id` (UNIQUE) y `notification_preferences.user_id` (PK); el resto es 1:N. No hay tablas puente puras: `report_matches`, `report_flags`, `ad_flags` y `chats` tienen PK propia y UNIQUE compuesto.

## Diferencias entre migraciones y `schema.prisma`

| # | Diferencia | Evidencia |
| --- | --- | --- |
| 1 | Índices definidos solo en SQL, no declarados en `schema.prisma` (las columnas son `Unsupported`): `reports_location_idx` (GIST), `notification_preferences_location_idx` (GIST), `report_embeddings_embedding_idx` (HNSW `vector_cosine_ops`) | `20260809000000_init:132`; `20261028000000_add_notification_preferences:27`; `20261014000000_dinov2_embedding_dimension:11`; `schema.prisma:160`, `:210`, `:327` |
| 2 | `pets.photo_urls` es `TEXT[] NOT NULL` sin default; `businesses.social_links` es `TEXT[]` nullable con default `'{}'`. `schema.prisma` declara ambas como `String[]` y no expresa la diferencia de nulabilidad | `20260811220000_add_pet_color_and_photos:4-6`; `20261101010000_business_profile_links:3`; `schema.prisma:121`, `:402` |
| 3 | El comentario de cabecera indica que el Backend IA lee y escribe `reports` y `report_embeddings`; también escribe `report_matches` con SQL crudo | `schema.prisma:3-5`; `backend-ia/app/services/matching_service.py:142-151` |

Columnas, tipos, FK, `ON DELETE`, UNIQUE e índices restantes coinciden. La comparación fue manual; no se ejecutó `prisma migrate diff`.

## Contraste con el ORM del Backend IA

| Elemento | Base de datos | `backend-ia/app/models.py` |
| --- | --- | --- |
| `reports` | 14 columnas | Mapea 5: `id`, `report_type`, `status`, `image_url`, `created_at` (`:18-27`) |
| `reports.report_type`, `reports.status` | Enums `report_type`, `report_status` | `String(20)` (`:24-25`) |
| `reports.image_url` | `TEXT` | `String(500)` (`:26`) |
| `report_embeddings.embedding` | `vector(768)` | `Vector(768)` (`:37`), coincide |
| `report_embeddings.report_id` | FK con `ON DELETE CASCADE` | `ForeignKey("reports.id")` sin `ondelete`; sin efecto porque no se usa `create_all` (`:1-5`) |
| `report_matches` | Tabla | Sin modelo ORM; se escribe con SQL crudo |

No se trata de tablas nuevas: son mapeos de tablas creadas por Prisma.

## Limitaciones

- Se excluye `_prisma_migrations`: tabla de control que crea Prisma al aplicar migraciones; no figura en ningún `migration.sql`.
- Las columnas `location` son `geometry(Point,4326)`, no `geography`; el cast a `geography` ocurre en las consultas (`matching_service.py:118`).
- Las restricciones `ON DELETE`, los índices no únicos y los valores de los 17 tipos enumerados se documentan en tarjetas del diagrama, no en las tablas.
- La migración `20261012000000_backfill_email_verified_at` solo modifica datos; no altera el esquema.
- Exportaciones: la CLI de Archify no genera SVG ni PNG del diagrama; la exportación SVG/PNG está disponible desde el botón "Exportar" del visor HTML. Las capturas PNG de `visual-check/` son evidencia de revisión, no exportaciones.
- Revisión visual: se inspeccionó la captura `visual-check/modelo-datos.visual-check.2048x1320.light.png` (parte superior del lienzo); las tablas, tipos y bandas de dominio se leen. No se revisó perceptualmente la parte inferior ni el tema oscuro.
