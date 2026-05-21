# ============================================================
# Dockerfile — SIG Municipal Backend
# Build multi-stage: desarrollo y producción
# Imagen base: node:20-alpine (ligera y segura)
# ============================================================

# ── Etapa base: dependencias compartidas ─────────────────────
FROM node:20-alpine AS base

LABEL maintainer="SIG Municipal <sig@municipalidad.cl>"
LABEL descripcion="API REST para la plataforma WebGIS SIG Municipal"

# Instalar dependencias del sistema necesarias para node-gyp y pg
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Crear usuario no-root para seguridad
RUN addgroup -S siggroup && adduser -S siguser -G siggroup

WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./

# ── Etapa de desarrollo ───────────────────────────────────────
FROM base AS desarrollo

ENV NODE_ENV=development

# Instalar todas las dependencias (incluyendo devDependencies)
RUN npm install

# Copiar el código fuente
COPY --chown=siguser:siggroup . .

USER siguser

EXPOSE 3000

# Modo desarrollo con recarga automática
CMD ["npm", "run", "dev"]

# ── Etapa de build (preparación para producción) ──────────────
FROM base AS build

ENV NODE_ENV=production

# Instalar solo dependencias de producción
RUN npm install --only=production

# ── Etapa de producción ───────────────────────────────────────
FROM node:20-alpine AS produccion

ENV NODE_ENV=production

# Instalar dependencias runtime mínimas
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Crear usuario no-root
RUN addgroup -S siggroup && adduser -S siguser -G siggroup

WORKDIR /app

# Copiar node_modules de la etapa build (solo prod)
COPY --from=build --chown=siguser:siggroup /app/node_modules ./node_modules

# Copiar código fuente
COPY --chown=siguser:siggroup . .

# Eliminar archivos innecesarios en producción
RUN rm -rf tests/ .env.example

USER siguser

EXPOSE 3000

# dumb-init maneja señales correctamente en contenedores
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

# Healthcheck interno de Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
