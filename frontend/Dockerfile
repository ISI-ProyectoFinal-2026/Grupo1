# imagen del frontend (#370)
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# mismo install que el CI
RUN npm ci --legacy-peer-deps
COPY . .
# variables VITE_ (quedan embebidas en el bundle)
ARG VITE_SOCKET_URL=
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
RUN npm run build

FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
