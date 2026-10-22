# ADR-0008: Cloudflare R2 con subida directa mediante URLs prefirmadas

- **Estado:** Aceptada
- **Responsables:** Agustín Díaz

## Decisión

Las imágenes se almacenan en Cloudflare R2 y el navegador las sube directamente con URLs prefirmadas (PUT, 5 minutos) que emite el backend.

## Motivo

- R2 no cobra egreso, el costo que más crece cuando cada imagen se ve muchas veces (feed, detalle, flyers, chat); Amazon S3 y Google Cloud Storage sí lo cobran.
- Su capa gratuita mensual (10 GB de almacenamiento, 1 millón de escrituras y 10 millones de lecturas) cubre el piloto, y la compatibilidad con la API de S3 permite migrar sin cambiar el código.
- La subida directa evita que las imágenes (hasta 10 MB) atraviesen el backend, que solo firma la URL y valida tipo, tamaño y nombre del objeto (un UUID, nunca el nombre original).

## Consecuencias

- El backend valida que la URL de la imagen pertenezca a su bucket, pero no que el objeto exista: una subida fallida deja un reporte con una imagen inexistente, que el servicio de IA no puede procesar y que por eso no llega a publicarse.

## Referencias

[PR #54](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/54), [PR #148](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/148); [precios de R2](https://developers.cloudflare.com/r2/pricing/).
