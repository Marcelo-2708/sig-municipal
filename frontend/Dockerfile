# ── Etapa 1: construcción ────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copia manifiestos primero para aprovechar la caché de capas de Docker
COPY package.json package-lock.json* ./
RUN npm install --prefer-offline

# Copia el resto del código fuente
COPY . .

# Construye la aplicación para producción
RUN npm run build

# ── Etapa 2: producción ──────────────────────────────────────────────────────
FROM nginx:alpine AS produccion

# Copia el resultado del build al directorio de nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copia configuración personalizada de nginx para SPA (historyApiFallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
