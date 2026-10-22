---
seccion: "1.2.4"
titulo: "Modelo de Datos"
nivel: 3
fase: A
estado: borrador
actualizado: 2026-10-22
---

# 1.2.4 Modelo de Datos

El sistema usa una única base PostgreSQL 16 con las extensiones PostGIS y pgvector ([ADR-0003](../adr/0003-postgresql-postgis-pgvector.md)). El esquema lo define Prisma 5, que es la única fuente de migraciones ([ADR-0004](../adr/0004-prisma-5-orm.md)). Según [`schema.prisma`](../../backend/prisma/schema.prisma) contiene 13 modelos y 9 enumeraciones, y se construyó con 14 migraciones en [`backend/prisma/migrations/`](../../backend/prisma/migrations).

## Entidades

| Modelo | Tabla | Contenido | Restricciones e índices |
|---|---|---|---|
| `User` | `users` | Cuenta: email, hash de contraseña, nombre, teléfono, rol, `token_version`, `email_verified_at` y seis columnas del segundo factor (2FA) | `email` único |
| `AuthToken` | `auth_tokens` | Token de un solo uso (verificación de email, restablecimiento, 2FA); se guarda solo su sha256 | `token_hash` único; índice `(user_id, type)`; borrado en cascada |
| `TwoFactorRecoveryCode` | `two_factor_recovery_codes` | Códigos de recuperación del 2FA, guardados como sha256 | único `(user_id, code_hash)`; borrado en cascada |
| `Pet` | `pets` | Mascota: nombre, especie, raza, edad, color, descripción, fotos (`photo_urls`), microchip | FK a `users` |
| `Report` | `reports` | Reporte de mascota perdida o encontrada: tipo, estado (por defecto `pending`), título, descripción, `image_url`, `custom_flyer_url`, ubicación `geometry(Point, 4326)`, dirección, `published_at` | índices `status` y `report_type`; `pet_id` opcional |
| `ReportFlag` | `report_flags` | Denuncia de un usuario sobre un reporte, con motivo y estado | único `(report_id, user_id)`; índices `status` y `report_id` |
| `ReportEmbedding` | `report_embeddings` | Embedding de la imagen del reporte, `vector(512)` | `report_id` único |
| `ReportMatch` | `report_matches` | Coincidencia sugerida entre un reporte perdido y uno encontrado, con puntaje de similitud y estado | único `(report_lost_id, report_found_id)`; índices `report_found_id` y `status` |
| `Chat` | `chats` | Conversación entre dos usuarios por reporte; el par se guarda normalizado (id menor en `user_a_id`) | único `(user_a_id, user_b_id, report_id)`; `report_id` opcional |
| `Message` | `messages` | Mensaje de texto y/o imagen dentro de un chat | FK a `chats` y `users` |
| `Notification` | `notifications` | Aviso a un usuario (sugerencia de coincidencia, mensaje, cambio de estado) | índice `user_id` |
| `Business` | `businesses` | Comercio de un usuario: nombre, CUIT, dirección, teléfono, categoría, plan y vencimiento | `user_id` y `cuit` únicos |
| `BusinessEvent` | `business_events` | Registro de visitas y contactos al perfil de un comercio; `user_id` nulo para visitantes anónimos | índice `(business_id, type)`; cascada con el comercio |

Fuente: `backend/prisma/schema.prisma`, líneas 26-353.

## Relaciones

- `User` se relaciona 1:N con `Pet`, `Report`, `ReportFlag`, `Message`, `Notification`, `AuthToken`, `TwoFactorRecoveryCode` y `BusinessEvent`, y 1:1 con `Business` (como máximo uno por usuario).
- `Pet` se relaciona 1:N con `Report`, pero el reporte puede existir sin mascota.
- `Report` se relaciona 1:N con `ReportFlag`, `Chat` y `Notification`, y 1:1 con `ReportEmbedding`.
- `ReportMatch` une dos reportes: uno perdido (`report_lost_id`) y uno encontrado (`report_found_id`).
- `Chat` une a dos usuarios (`user_a_id`, `user_b_id`) y, opcionalmente, a un reporte; contiene 1:N `Message`.
- `Business` se relaciona 1:N con `BusinessEvent`.

## Enumeraciones

| Enumeración | Valores |
|---|---|
| `role` | `usuario_regular`, `moderador`, `admin` |
| `auth_token_type` | `email_verification`, `password_reset`, `two_factor_login`, `two_factor_reset`, `two_factor_reset_cancel` |
| `report_type` | `lost`, `found` |
| `report_status` | `pending`, `published`, `rejected`, `resolved` |
| `report_flag_status` | `pending`, `reviewed` |
| `match_status` | `pending`, `confirmed`, `rejected` |
| `business_category` | `VETERINARIA`, `REFUGIO`, `PET_SHOP`, `OTRO` |
| `business_plan` | `FREE`, `PRO`, `PREMIUM` |
| `business_event_type` | `VIEW`, `CONTACT` |

## Tipos geoespaciales y vectoriales

- **Ubicación.** `reports.location` es `geometry(Point, 4326)`. Prisma no lo soporta de forma nativa, por lo que se declara `Unsupported` (`schema.prisma:158`) y se consulta con SQL crudo ([ADR-0004](../adr/0004-prisma-5-orm.md)).
- **Embedding.** `report_embeddings.embedding` es `vector(512)`, también `Unsupported` (`schema.prisma:208`). La migración inicial lo creó con 1536 dimensiones y `20260813000000_fix_report_embedding_dimension` lo cambió a 512 antes de que existieran filas ([ADR-0013](../adr/0013-dimension-embedding-512.md)).
- **Índices.** El índice GiST sobre `reports.location` y el índice HNSW (`vector_cosine_ops`) sobre `report_embeddings.embedding` existen solo en las migraciones SQL (`20260809000000_init`, líneas 132 y 138; el HNSW se recrea en `20260813000000_fix_report_embedding_dimension`, línea 7). `schema.prisma` no los declara.
- **Extensiones.** `postgis` y `vector` se crean en `20260809000000_init` (líneas 2 y 5) y figuran en `schema.prisma:15`.

## Subconjunto usado por el backend de IA

El servicio de IA mapea con SQLAlchemy dos tablas del esquema ([`backend-ia/app/models.py`](../../backend-ia/app/models.py), líneas 18-38): `reports` (cinco columnas: `id`, `report_type`, `status`, `image_url`, `created_at`) y `report_embeddings` (`id`, `report_id`, `embedding` de 512 dimensiones, `created_at`). No genera migraciones. La sincronización entre ambos mapeos no se verifica de forma automática (issue [#213](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/213)).

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

Fuente: `backend/prisma/migrations/*/migration.sql`.
