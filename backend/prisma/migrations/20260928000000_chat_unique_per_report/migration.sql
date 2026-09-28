-- #173: el chat pasa a ser POR REPORTE y el par de usuarios se guarda
-- normalizado (user_a_id = id menor, user_b_id = id mayor). El unique viejo
-- (user_a_id, user_b_id) era direccional: (A,B) y (B,A) eran filas distintas.

-- 1. Soltar el unique viejo antes de normalizar: el swap de (B,A) a (A,B)
--    podría chocar con una fila (A,B) ya existente.
DROP INDEX "chats_user_a_id_user_b_id_key";

-- 2. Normalizar el par. En Postgres el SET usa los valores previos de la fila,
--    así que esto intercambia las dos columnas. chats no tiene otras columnas
--    "por lado" (messages.sender_id guarda el id absoluto del emisor).
UPDATE "chats"
SET "user_a_id" = "user_b_id", "user_b_id" = "user_a_id"
WHERE "user_a_id" > "user_b_id";

-- 3. La normalización puede dejar duplicados (A,B,R) + (A,B,R) si antes
--    existían (A,B,R) y (B,A,R). Se conserva el chat más viejo (menor id),
--    se le mueven los mensajes del duplicado y se borra el duplicado.
--    Los chats con report_id NULL no chocan (Postgres trata NULL como distinto).
WITH "ranked" AS (
  SELECT "id", MIN("id") OVER (PARTITION BY "user_a_id", "user_b_id", "report_id") AS "keep_id"
  FROM "chats"
  WHERE "report_id" IS NOT NULL
)
UPDATE "messages" AS m
SET "chat_id" = r."keep_id"
FROM "ranked" AS r
WHERE m."chat_id" = r."id" AND r."id" <> r."keep_id";

WITH "ranked" AS (
  SELECT "id", MIN("id") OVER (PARTITION BY "user_a_id", "user_b_id", "report_id") AS "keep_id"
  FROM "chats"
  WHERE "report_id" IS NOT NULL
)
DELETE FROM "chats" AS c
USING "ranked" AS r
WHERE c."id" = r."id" AND r."id" <> r."keep_id";

-- 4. Unique nuevo: un chat por par normalizado + reporte.
CREATE UNIQUE INDEX "chats_user_a_id_user_b_id_report_id_key" ON "chats"("user_a_id", "user_b_id", "report_id");
