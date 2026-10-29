-- Cambia el embedding de report_embeddings de OpenCLIP ViT-B-32 (vector(512)) a
-- DINOv2 ViT-B/14 (vector(768)), que separa mucho mejor la identidad de cada
-- mascota (ver backend-ia/app/ml/pipeline.py).
-- Los embeddings existentes son de otro modelo y otro espacio vectorial: no se
-- pueden convertir. Se vacía la tabla y se regeneran desde las imágenes con
-- `python -m scripts.reembed_reports --all` en backend-ia.
-- El índice HNSW depende del tipo exacto de la columna, así que se dropea y se recrea.
DROP INDEX "report_embeddings_embedding_idx";
DELETE FROM "report_embeddings";
ALTER TABLE "report_embeddings" ALTER COLUMN "embedding" TYPE vector(768);
CREATE INDEX "report_embeddings_embedding_idx" ON "report_embeddings" USING hnsw ("embedding" vector_cosine_ops);
