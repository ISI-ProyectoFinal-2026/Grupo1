# ADR-0011: Imagen Docker de PostgreSQL con base oficial y PGDG

- **Estado:** Aceptada
- **Responsables:** Gabriel Valdivieso

## Decisión

La base se ejecuta en un contenedor construido desde la imagen oficial `postgres:16-bookworm` (Debian 12), con PostGIS y pgvector instalados desde el repositorio oficial de paquetes de PostgreSQL (PGDG), y se publica en el puerto 5433 del host.

## Motivo

- Historial: la imagen inicial fue `postgis/postgis:16-3.4`, con PostGIS preinstalado. El CI empezó a fallar porque todas las variantes de esa imagen para PostgreSQL 16 están sobre Debian 11 (bullseye), sin soporte: su índice de seguridad expiró y `apt-get update` lo rechaza.
- Una base oficial sobre Debian 12 corrige la construcción de forma definitiva.
- El puerto 5433 evita conflictos con una instalación local de PostgreSQL en el puerto 5432.

## Alternativas

Se descartaron la variante `16-3.5`, también sobre bullseye, y desactivar la verificación de vencimiento de `apt`, que dejaría la imagen sobre una distribución sin soporte ni actualizaciones de seguridad.

## Consecuencias

- La imagen ya no trae PostGIS preinstalado: se instala en la construcción. La versión 16 se mantuvo ([ADR-0003](0003-postgresql-postgis-pgvector.md)).
- El `docker-compose` solo levanta la base de datos: los servicios de aplicación se ejecutan fuera de contenedores.

## Referencias

[PR #164](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/164) (reemplazada), [PR #165](https://github.com/ISI-ProyectoFinal-2026/Grupo1/pull/165); commits `8f30a6c`, `918704a`, `afd0d71`.
