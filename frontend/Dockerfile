FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
ENV VITE_API_URL=/api/v1
ENV VITE_SOCKET_URL=
RUN npm run build
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
