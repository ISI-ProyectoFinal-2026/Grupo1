# PostgreSQL + PostGIS + pgvector for PATITAS
#
# Base: the official postgres image on Debian 12 (bookworm), which already ships
# the PGDG apt repo. We install PostGIS and pgvector from it.
#
# Why not postgis/postgis: every PG16 tag of that image (16-3.4, 16-3.5) is built
# on Debian 11 (bullseye). Bullseye reached end of life and the Release file of
# its security suite expired, so `apt-get update` refuses it and the build fails
# with exit code 100. Pinning the base to bookworm fixes the build for good
# instead of disabling apt's expiry check, which would leave the image on an
# unsupported distro with no security updates.
FROM postgres:16-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-16-postgis-3 \
        postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*

COPY init.sql /docker-entrypoint-initdb.d/10-extensions.sql
