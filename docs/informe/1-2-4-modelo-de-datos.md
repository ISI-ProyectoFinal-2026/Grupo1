---
seccion: "1.2.4"
titulo: "Modelo de Datos"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-11-11
---

# 1.2.4 Modelo de Datos

El sistema usa una única base PostgreSQL 16 con las extensiones PostGIS y pgvector ([ADR-0003](../adr/0003-postgresql-postgis-pgvector.md)). El esquema lo define Prisma 5, que es la única fuente de migraciones ([ADR-0004](../adr/0004-prisma-5-orm.md)). Según [`schema.prisma`](../../backend/prisma/schema.prisma) contiene 22 modelos y 21 enumeraciones, y se construyó con 30 migraciones en [`backend/prisma/migrations/`](../../backend/prisma/migrations).

## Entidades

| Modelo | Tabla | Contenido | Restricciones e índices |
|---|---|---|---|
| `User` | `users` | Cuenta: email, hash de contraseña, nombre, teléfono, rol, `token_version`, `email_verified_at` y seis columnas del segundo factor (2FA) | `email` único |
| `AuthToken` | `auth_tokens` | Token de un solo uso (verificación de email, restablecimiento, 2FA); se guarda solo su sha256 | `token_hash` único; índice `(user_id, type)`; borrado en cascada |
| `TwoFactorRecoveryCode` | `two_factor_recovery_codes` | Códigos de recuperación del 2FA, guardados como sha256 | único `(user_id, code_hash)`; borrado en cascada |
| `Pet` | `pets` | Mascota: nombre, especie, raza, edad, color, descripción, fotos (`photo_urls`, hasta 4, validado en la API: `backend/src/validators/pets.validator.ts:4`), microchip | FK a `users`; cascada con el usuario |
| `Report` | `reports` | Reporte de mascota perdida o encontrada: tipo, estado (por defecto `pending`), título, descripción, `image_url` (foto principal), `extra_image_urls` (hasta 3 fotos extra, validado en la API: `backend/src/validators/reports.validator.ts:34`), `custom_flyer_url`, ubicación `geometry(Point, 4326)`, dirección, `show_phone_on_flyer`, fecha del suceso (`event_date`), `published_at` | índices `status` y `report_type`; `pet_id` opcional; cascada con el usuario |
| `ReportFlag` | `report_flags` | Denuncia de un usuario sobre un reporte, con motivo y estado | único `(report_id, user_id)`; índices `status` y `report_id` |
| `ReportEmbedding` | `report_embeddings` | Embedding de la imagen del reporte, `vector(768)` (DINOv2 ViT-B/14, [ADR-0021](../adr/0021-modelo-embeddings-dinov2.md)) | `report_id` único; cascada con el reporte |
| `ReportMatch` | `report_matches` | Coincidencia sugerida entre un reporte perdido y uno encontrado, con puntaje de similitud y estado | único `(report_lost_id, report_found_id)`; índices `report_found_id` y `status` |
| `Chat` | `chats` | Conversación entre dos usuarios por reporte; el par se guarda normalizado (id menor en `user_a_id`) | único `(user_a_id, user_b_id, report_id)`; `report_id` opcional |
| `Message` | `messages` | Mensaje de texto y/o imagen dentro de un chat | FK a `chats` y `users` |
| `Notification` | `notifications` | Aviso a un usuario (sugerencia de coincidencia, mensaje, cambio de estado) | índice `user_id` |
| `NotificationPreference` | `notification_preferences` | Preferencias de notificación por tipo, radio y tipo de reporte cercano, consentimiento y última ubicación `geometry(Point, 4326)` del usuario ([ADR-0022](../adr/0022-preferencias-notificacion-tabla-propia.md)) | PK `user_id`; índice GiST `location`; cascada con el usuario |
| `AccountReport` | `account_reports` | Denuncia de una cuenta con gravedad (`mild`, `moderate`, `severe`), asociada a la sanción que originó | único parcial `(reported_user_id, reporter_id)` con `sanction_id` nulo; índice `(reported_user_id, sanction_id)` |
| `AccountSanction` | `account_sanctions` | Sanción de cuenta: gravedad, tipo, estado, advertencia, motivo, denuncias que la dispararon, inicio y fin | único parcial `user_id` con estado `active` o `pending_review`; índices `(user_id, status)` y `(status, ends_at)` |
| `AccountSanctionEvent` | `account_sanction_events` | Historial de una sanción (creada, confirmada, revertida, desestimada, vencida); `actor_id` nulo = sistema | índice `sanction_id` |
| `RoleChangeAudit` | `role_change_audits` | Historial de cambios de rol hechos por un administrador | índice `created_at` |
| `Business` | `businesses` | Comercio de un usuario: nombre, CUIT, dirección, teléfono, categoría, latitud y longitud del pin del mapa, descripción, sitio web, hasta 5 enlaces a redes (`social_links`, solo URLs http o https), plan y vencimiento. Un `PREMIUM` vencido o sin vencimiento cuenta como `FREE` ([ADR-0024](../adr/0024-modelo-monetizacion.md)) | `user_id` y `cuit` únicos |
| `Subscription` | `subscriptions` | Compra del plan Premium: período, monto en USD, proveedor de pago (`fake` mientras no haya pasarela), referencia, estado y período cubierto (nulo si el pago se rechazó) | índice `business_id`; cascada con el comercio |
| `Ad` | `ads` | Anuncio de un comercio: título (hasta 60 caracteres), texto (hasta 200), imagen del bucket propio, radio de 1 a 20 km y estado (`ACTIVE` y `PAUSED` los maneja el dueño; `REMOVED` es una baja por moderación). Hasta 3 activos por comercio, que exigen Premium vigente y la ubicación del comercio cargada | índice `(business_id, status)`; cascada con el comercio |
| `AdEvent` | `ad_events` | Impresión o clic de un anuncio y la ubicación de la plataforma donde ocurrió (`feed` o `report_detail`). No guarda usuario ni coordenadas: el comercio solo ve totales ([ADR-0024](../adr/0024-modelo-monetizacion.md)) | índice `(ad_id, created_at)`; cascada con el anuncio |
| `AdFlag` | `ad_flags` | Denuncia de un usuario sobre un anuncio, con motivo y estado: pendiente, anuncio dado de baja (`removed`) o denuncia desestimada (`dismissed`) | único `(ad_id, user_id)`; índice `status`; cascada con el anuncio |
| `BusinessEvent` | `business_events` | Registro de visitas y contactos al perfil de un comercio; `user_id` nulo para visitantes anónimos | índice `(business_id, type)`; cascada con el comercio |

Fuente: `backend/prisma/schema.prisma`, líneas 26-647.

## Relaciones

- `User` se relaciona 1:N con `Pet`, `Report`, `ReportFlag`, `Message`, `Notification`, `AuthToken`, `TwoFactorRecoveryCode`, `BusinessEvent`, `AccountReport` (como denunciante y como denunciado), `AccountSanction`, `AccountSanctionEvent` y `RoleChangeAudit` (como actor y como destino), y 1:1 con `Business` (como máximo uno por usuario) y con `NotificationPreference`.
- `AccountSanction` se relaciona 1:N con `AccountReport` y `AccountSanctionEvent`.
- Al eliminar una cuenta, sus datos se borran en cascada; en `account_sanction_events` y `role_change_audits` el actor pasa a nulo (`20261110000000_cascade_user_deletion`).
- `Pet` se relaciona 1:N con `Report`, pero el reporte puede existir sin mascota.
- `Report` se relaciona 1:N con `ReportFlag`, `Chat` y `Notification`, y 1:1 con `ReportEmbedding`.
- `ReportMatch` une dos reportes: uno perdido (`report_lost_id`) y uno encontrado (`report_found_id`).
- `Chat` une a dos usuarios (`user_a_id`, `user_b_id`) y, opcionalmente, a un reporte; contiene 1:N `Message`.
- `Business` se relaciona 1:N con `BusinessEvent`, `Subscription` y `Ad`; `Ad` se relaciona 1:N con `AdEvent` y `AdFlag`. `User` se relaciona además 1:N con `AdFlag`.

## Enumeraciones

| Enumeración | Valores |
|---|---|
| `role` | `usuario_regular`, `moderador`, `admin` |
| `auth_token_type` | `email_verification`, `password_reset`, `two_factor_login`, `two_factor_reset`, `two_factor_reset_cancel` |
| `report_type` | `lost`, `found` |
| `report_status` | `pending`, `published`, `rejected`, `resolved` |
| `report_flag_status` | `pending`, `reviewed`, `dismissed` |
| `match_status` | `pending`, `confirmed`, `rejected` |
| `business_category` | `VETERINARIA`, `REFUGIO`, `PET_SHOP`, `OTRO` |
| `business_plan` | `FREE`, `PREMIUM` |
| `business_event_type` | `VIEW`, `CONTACT` |
| `subscription_period` | `MONTHLY`, `ANNUAL` |
| `subscription_status` | `APPROVED`, `REJECTED` |
| `ad_status` | `ACTIVE`, `PAUSED`, `REMOVED` |
| `ad_event_type` | `impression`, `click` |
| `ad_placement` | `feed`, `report_detail` |
| `ad_flag_status` | `pending`, `removed`, `dismissed` |
| `account_report_severity` | `mild`, `moderate`, `severe` |
| `account_sanction_kind` | `temporary`, `provisional`, `permanent` |
| `account_sanction_status` | `active`, `pending_review`, `expired`, `reverted`, `dismissed` |
| `account_sanction_event_type` | `created`, `confirmed`, `reverted`, `dismissed`, `expired` |
| `location_consent_status` | `accepted`, `declined` |
| `nearby_report_filter` | `lost`, `found`, `both` |

## Tipos geoespaciales y vectoriales

- **Ubicación.** `reports.location` es `geometry(Point, 4326)`. Prisma no lo soporta de forma nativa, por lo que se declara `Unsupported` (`schema.prisma:168`); `notification_preferences.location` usa el mismo tipo (`schema.prisma:452`) y se consulta con SQL crudo ([ADR-0004](../adr/0004-prisma-5-orm.md)).
- **Embedding.** `report_embeddings.embedding` es `vector(768)`, también `Unsupported` (`schema.prisma:223`). La migración inicial lo creó con 1536 dimensiones y `20260813000000_fix_report_embedding_dimension` lo cambió a 512 antes de que existieran filas ([ADR-0013](../adr/0013-dimension-embedding-512.md)). `20261014000000_dinov2_embedding_dimension` lo cambió a 768 y vació la tabla, porque los embeddings de OpenCLIP no son comparables con los de DINOv2 ([ADR-0021](../adr/0021-modelo-embeddings-dinov2.md)); se regeneran con `backend-ia/scripts/reembed_reports.py`.
- **Índices.** El índice GiST sobre `reports.location` y el índice HNSW (`vector_cosine_ops`) sobre `report_embeddings.embedding` existen solo en las migraciones SQL (`20260809000000_init`, líneas 132 y 138; el HNSW se recrea en `20260813000000_fix_report_embedding_dimension`, línea 7, y en `20261014000000_dinov2_embedding_dimension`, línea 11). `schema.prisma` no los declara.
- **Extensiones.** `postgis` y `vector` se crean en `20260809000000_init` (líneas 2 y 5) y figuran en `schema.prisma:15`.

## Subconjunto usado por el backend de IA

El servicio de IA mapea con SQLAlchemy dos tablas del esquema ([`backend-ia/app/models.py`](../../backend-ia/app/models.py), líneas 18-38): `reports` (cinco columnas: `id`, `report_type`, `status`, `image_url`, `created_at`) y `report_embeddings` (`id`, `report_id`, `embedding` de 768 dimensiones, `created_at`). No genera migraciones. La sincronización entre ambos mapeos no se verifica de forma automática (issue [#213](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/213)).

## Evolución del esquema

| Migración | Cambio |
|---|---|
| `20260809000000_init` | Extensiones `postgis` y `vector`; 8 tablas (`users`, `pets`, `reports`, `report_embeddings`, `report_matches`, `chats`, `messages`, `notifications`) y sus enumeraciones |
| `20260809010000_add_chat_unique_and_report_match_index` | Único `(user_a_id, user_b_id)` en `chats`; índice por `report_found_id` |
| `20260811220000_add_pet_color_and_photos` | Columnas `color` y `photo_urls` en `pets` |
| `20260813000000_fix_report_embedding_dimension` | `vector(1536)` pasa a `vector(512)` |
| `20260814220000_add_report_flags` | Tabla `report_flags` |
| `20260820120000_add_business_model` | Tabla `businesses` y sus enumeraciones |
| `20260902000000_add_message_image_url` | Columna `image_url` en `messages` |
| `20260907000000_add_business_events` | Tabla `business_events` |
| `20260908000000_add_report_custom_flyer_url` | Columna `custom_flyer_url` en `reports` |
| `20260928000000_chat_unique_per_report` | El chat pasa a ser por reporte, con el par de usuarios normalizado |
| `20260928010000_add_user_role` | Enumeración `role` y columna `users.role` |
| `20260928020000_email_verification_and_auth_tokens` | `email_verified_at` y `token_version` en `users`; tabla `auth_tokens` |
| `20261012000000_backfill_email_verified_at` | Las cuentas anteriores a la verificación se marcan como verificadas (solo datos) |
| `20261013000000_two_factor_auth` | Columnas de 2FA en `users`; tabla `two_factor_recovery_codes`; tres tipos nuevos en `auth_token_type` |
| `20261014000000_dinov2_embedding_dimension` | `vector(512)` pasa a `vector(768)`; se vacía `report_embeddings` y se recrea el índice HNSW |
| `20261027000000_add_business_location` | Columnas `latitude` y `longitude` en `businesses` |
| `20261028000000_add_notification_preferences` | Tabla `notification_preferences` y sus enumeraciones |
| `20261029000000_cascade_report_dependents` | Borrado en cascada de `report_embeddings`, `report_matches` y `report_flags` al eliminar un reporte |
| `20261101000000_premium_subscriptions` | Se elimina `PRO` de `business_plan` (los comercios con `PRO` pasan a `FREE`); tabla `subscriptions` y sus enumeraciones |
| `20261101010000_business_profile_links` | Columnas `description`, `website` y `social_links` en `businesses` |
| `20261101020000_add_ads` | Tabla `ads` y la enumeración `ad_status` |
| `20261101030000_add_ad_events` | Tabla `ad_events` y sus enumeraciones |
| `20261101040000_add_ad_flags` | Tabla `ad_flags` y la enumeración `ad_flag_status` |
| `20261102000000_report_flag_dismissed` | Valor `dismissed` en `report_flag_status` |
| `20261103000000_report_show_phone_on_flyer` | Columna `show_phone_on_flyer` en `reports` |
| `20261103010000_report_event_date` | Columna `event_date` en `reports` |
| `20261104000000_add_role_change_audits` | Tabla `role_change_audits` |
| `20261105000000_account_reports_and_sanctions` | Tablas `account_reports`, `account_sanctions` y `account_sanction_events`, sus enumeraciones e índices únicos parciales |
| `20261110000000_cascade_user_deletion` | Borrado en cascada desde `users`; `actor_id` de `account_sanction_events` y `role_change_audits` pasa a `SET NULL` |
| `20261110000000_report_extra_image_urls` | Columna `extra_image_urls` en `reports` |

Fuente: `backend/prisma/migrations/*/migration.sql`.
