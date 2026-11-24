# ADR-0031: Demo local con Docker Compose y una imagen por servicio

- **Estado:** Aceptada
- **Responsables:** Matías Alvarado

## Decisión

La demo se levanta con un solo `docker compose up -d`: backend, Backend IA y frontend tienen imagen propia junto a PostgreSQL, con healthchecks; la imagen del Backend IA incluye los pesos de los modelos y arranca sin red, el frontend se sirve con nginx como proxy de la API, y el backend aplica las migraciones al arrancar.

## Motivo

- La entrega es una demo local, sin despliegue, y el stack de Docker Compose es el entorno real del proyecto.
- En una máquina limpia, como la del evaluador, no hace falta instalar Node ni Python ni arrancar cuatro procesos a mano.
- Los pesos de YOLO y DINOv2 quedan dentro de la imagen, así el Backend IA no depende de descargas al arrancar.
- Los healthchecks y el script de preflight muestran qué falla antes de la demo, en lugar de dejar reportes en `pending` o el mapa en gris.

## Alternativas

Desplegar en la nube: descartado porque la entrega es una demo local.

## Consecuencias

- La imagen del Backend IA pesa 3,38 GB aun con PyTorch solo CPU, y en Windows con poca memoria Docker Desktop puede caerse si se construyen todas las imágenes juntas.
- Las fotos (R2) y las teselas del mapa (OpenStreetMap) siguen necesitando internet.
- El backend aplica las migraciones pendientes en cada arranque, sin paso manual.

## Referencias

[Issue #370](https://github.com/ISI-ProyectoFinal-2026/Grupo1/issues/370); [ADR-0011](0011-imagen-docker-postgres.md); [ADR-0021](0021-modelo-embeddings-dinov2.md); [ADR-0026](0026-backup-servicio-node-docker.md).
