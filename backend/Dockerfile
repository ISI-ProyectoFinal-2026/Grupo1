# imagen del backend principal (#370)
FROM node:24-bookworm-slim AS build
# openssl: Prisma elige el motor según la versión de libssl
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# mismo install que el CI
RUN npm ci --legacy-peer-deps
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:24-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# NODE_ENV lo define backend/.env: en production SMTP y 2FA pasan a ser obligatorios
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --legacy-peer-deps
# cliente generado y CLI de Prisma (migrate deploy al arrancar)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY prisma ./prisma
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3001
# migraciones pendientes y después el servidor
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && exec node dist/index.js"]
