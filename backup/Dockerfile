# Servicio de backup de PATITAS (issue #263)
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim
# cliente de PostgreSQL 16 desde PGDG: pg_dump/pg_restore de la misma versión que el servidor
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates postgresql-common tzdata \
    && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
    && apt-get install -y --no-install-recommends postgresql-client-16 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps
COPY --from=build /app/dist ./dist
VOLUME ["/backups"]
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["daemon"]
