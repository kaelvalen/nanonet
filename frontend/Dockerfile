# --- Development stage ---
FROM node:20-alpine AS dev

WORKDIR /app

# Workspace root manifests
COPY package.json package-lock.json* ./

# Shared-types manifest (source volume-mounted in dev)
COPY packages/shared-types/package.json ./packages/shared-types/

# Frontend manifest
COPY frontend/package.json ./frontend/

# Install frontend + shared-types workspace deps only
RUN npm install --workspace=frontend --workspace=packages/shared-types

WORKDIR /app/frontend
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- Production builder stage ---
FROM node:20-alpine AS builder

ARG VITE_API_URL=/api/v1
ARG VITE_WS_URL=ws://localhost:8080/ws

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/ ./packages/
COPY frontend/package.json ./frontend/

RUN npm install --workspace=frontend --workspace=packages/shared-types

COPY frontend/ ./frontend/

WORKDIR /app/frontend
RUN npm run build

FROM nginx:alpine AS prod

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/nginx.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
