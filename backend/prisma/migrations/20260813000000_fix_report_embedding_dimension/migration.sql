-- Corrige la dimensión del embedding de report_embeddings: vector(1536) -> vector(512).
-- El modelo validado (ViT-B-32, pretrained laion2b_s34b_b79k, ver docs/pocs/POC_Similitudes.ipynb)
-- devuelve 512 dims, no 1536. La tabla todavía no tiene filas, es seguro.
-- El índice HNSW depende del tipo exacto de la columna, así que se dropea y se recrea.
DROP INDEX "report_embeddings_embedding_idx";
ALTER TABLE "report_embeddings" ALTER COLUMN "embedding" TYPE vector(512);
CREATE INDEX "report_embeddings_embedding_idx" ON "report_embeddings" USING hnsw ("embedding" vector_cosine_ops);
