-- Backfill
-- Las cuentas anteriores a la verificación de email se consideran verificadas: ya
-- venían usando la app y exigirles verificar ahora las dejaría sin poder publicar
-- ni chatear. Las cuentas nuevas nacen con email_verified_at en NULL. Es solo
-- datos (la columna ya existe) y es idempotente: no toca a los ya verificados.
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;
