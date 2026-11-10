-- fotos extra del reporte (max 3, validado en la API)
ALTER TABLE "reports" ADD COLUMN "extra_image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[];
