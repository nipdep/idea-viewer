FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN npm run build

FROM nginx:1.27-alpine

ARG VITE_BASE_PATH=/

ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV APP_BASE_PATH=

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/10-idea-viewer-config.sh /docker-entrypoint.d/10-idea-viewer-config.sh

RUN chmod +x /docker-entrypoint.d/10-idea-viewer-config.sh

EXPOSE 8080
