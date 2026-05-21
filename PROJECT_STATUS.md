# Estado del proyecto SIG Municipal

## Última actualización: 2026-05-02

---

## ✅ Fase 1 — COMPLETADA (2026-05-02)

Piloto verificado en `http://demo.localhost`: mapa funcional con 3 estilos base (calles, satélite, oscuro), panel de capas con toggle, login de funcionarios y capa WMS `predios` renderizando desde GeoServer.

### Infraestructura (DEVOPS_AGENT)
- `infra/docker/docker-compose.yml` — 6 servicios; env_file por servicio resuelve `.env` desde raíz del proyecto
- `infra/docker/docker-compose.prod.yml` — producción sin puertos expuestos salvo Nginx (80/443)
- `infra/nginx/nginx.conf` — gzip, headers de seguridad, log JSON estructurado, timeouts
- `infra/nginx/sites/municipios.conf` — proxy inverso `*.localhost` activo; bloques HTTPS comentados para producción
- `.env.example` — plantilla completa con `POSTGRES_*` aliases requeridos por el contenedor PostGIS

### Base de datos (DATABASE_AGENT)
- `database/migrations/001_esquema_publico.sql` — 6 tablas compartidas, rol `sig_app`, 22 índices, triggers
- `database/migrations/002_extensiones.sql` — PostGIS, uuid-ossp, pg_trgm, unaccent, FTS `spanish_unaccent`
- `database/migrations/003_funciones_utilidad.sql` — `buscar_predios()`, `zona_en_punto()`, `fn_actualizar_timestamp()`
- `database/migrations/004_seeds_desarrollo.sql` — municipio `demo`, 3 usuarios, 3 capas de ejemplo
- `database/spatial/template_municipio.sql` — tablas espaciales por municipio con placeholder `{municipio}`
- `database/scripts/crear_municipio.sql` — onboarding SQL parametrizado
- `database/scripts/init_mun_demo.sql` — esquema `mun_demo` concreto + 3 predios de muestra en Concepción
- `database/scripts/health_check.sql` — diagnóstico de extensiones, esquemas, índices y logs

### Backend API (BACKEND_AGENT)
- `backend/server.js` — Fastify con seguridad, Swagger en dev, apagado limpio
- `backend/src/config/` — `env.js` (validación al arrancar), `database.js` (pool pg + search_path por tenant)
- `backend/src/middleware/` — `tenant.js`, `auth.js` (5 roles), `rateLimit.js`, `errorHandler.js`
- `backend/src/routes/` — `health`, `auth`, `capas`, `predios`, `reportes`, `superadmin`
- `backend/src/services/` — `authService` (JWT + refresh rotation), `capaService`, `predioService`, `reporteService`, `geoserverService`

### Frontend (FRONTEND_AGENT)
- `frontend/` — Vite 5 + React 18 + MapLibre GL JS 4 + Zustand + React Query v5 + Tailwind CSS
- `frontend/src/components/mapa/` — `MapaBase`, `ControlCapas`, `BuscadorPredial`, `FichaPredio`, `SelectorMapaBase`
- `frontend/src/pages/` — `MapaPublico` (full-screen), `Login`, `Dashboard`, `AdminCapas`
- `frontend/src/store/` — `authStore` (localStorage), `mapaStore`
- `frontend/src/services/` — `api.js` (refresco JWT automático), `mapaUtils.js` (sync WMS)

### GeoServer piloto (GIS_AGENT)
- `geoserver/config/demo/` — workspace, namespace, datastore (`mun_demo`, host `sig_postgres`), layer, GWC
- `geoserver/estilos/demo_predios_style.sld` — 4 reglas por uso_suelo + etiquetas de dirección a escala > 1:5000
- `geoserver/config/demo/configurar_demo.ps1` — script PowerShell idempotente (POST/PUT) con retry loop

### Correcciones aplicadas durante el piloto
- `npm ci` → `npm install` en ambos Dockerfiles (no había lockfile)
- `docker-compose.yml` usa `env_file: ../../.env` por servicio; `.env` incluye `POSTGRES_*` aliases
- Columna `GENERATED ALWAYS AS (unaccent(...))` eliminada — `unaccent` es STABLE, no IMMUTABLE
- Índice FTS simplificado a `to_tsvector('spanish', direccion)` — expresión IMMUTABLE
- `configurar_demo.ps1` usa `PSCredential` en lugar de header manual (PS 5.1 descartaba el header en challenges 401)
- Paso 3 del script siempre hace PUT si el datastore existe — corrige host incorrecto de configuraciones previas

---

## 🔜 Fase 2 — Panel de administración (sem. 5–8)

### 2.1 Gestión de capas (FRONTEND_AGENT + BACKEND_AGENT)
- `AdminCapas` — tabla con todas las capas del municipio: nombre, categoría, visible_publico, orden
- Activar / desactivar capa con toggle (actualiza `capas.activo` vía `PUT /api/capas/:id`)
- Subir nueva capa: formulario con nombre, categoría, workspace GeoServer, nombre de tabla PostGIS
- Publicar capa en GeoServer desde el panel (llama a `geoserverService.publicarCapa()`)
- Previsualización de capa antes de publicar (GetMap en miniatura)
- Reordenar capas con drag & drop (actualiza `capas.orden`)

### 2.2 Gestión de usuarios y roles (FRONTEND_AGENT + BACKEND_AGENT)
- `AdminUsuarios` — tabla de usuarios del municipio con rol y estado
- Crear / editar usuario: nombre, email, rol (`funcionario` / `editor_gis` / `admin_municipal`)
- Desactivar usuario sin eliminar (soft delete con `activo = false`)
- Resetear contraseña por email (endpoint `POST /api/auth/reset-password`)
- Vista de perfil propio para cualquier rol autenticado

### 2.3 Onboarding de nuevo municipio (BACKEND_AGENT + DATABASE_AGENT + GIS_AGENT)
- Endpoint `POST /api/superadmin/municipios` — crea esquema BD + workspace GeoServer + registro en `public.municipios`
- Formulario `OnboardingMunicipio` (solo `super_admin`): nombre, código, subdominio, región, plan
- Ejecuta `crear_municipio.sql` parametrizado desde el backend
- Configura workspace GeoServer vía `geoserverService` (reutiliza lógica de `configurar_demo.ps1`)
- Tiempo objetivo: nuevo municipio operativo en < 48 horas

### 2.4 Log de cambios (FRONTEND_AGENT + BACKEND_AGENT)
- `LogCambios` — tabla paginada con filtro por capa, usuario y rango de fechas
- Endpoint `GET /api/capas/:id/log` y `GET /api/usuarios/:id/log`
- Detalle de cambio: diff JSON de valores anteriores y nuevos
- Exportar log a CSV

### 2.5 Dashboard admin (FRONTEND_AGENT)
- Métricas del municipio: total capas activas, usuarios activos, reportes pendientes, última actualización de datos
- Accesos directos a las secciones de administración
- Indicador de estado del stack (GeoServer, BD) vía `GET /api/health`

---

## 🔜 Fase 3 — Funcionalidades avanzadas (sem. 9–16)
- Búsqueda predial por dirección y rol SII (integra FTS + índice espacial)
- Módulo de reportes ciudadanos (alumbrado, veredas) con geolocalización
- Integración con IDE Chile (capas WMS nacionales: límites, hidrografía, vialidad)
- Dashboard analytics por municipio (visitas, capas más consultadas, reportes por zona)
- API pública documentada (OpenAPI / Swagger)

## 🔜 Fase 4 — Producción y escala (sem. 17+)
- SSL automático por subdominio (Certbot + Let's Encrypt wildcard)
- Monitoreo y alertas (Uptime Kuma + logs centralizados)
- Backups automáticos por tenant (pg_dump + compresión + rotación 7 días)
- Pipeline CI/CD completo (GitHub Actions: test → build → deploy)

---

## Bloqueadores
- (ninguno)

---

## Notas técnicas
- Ejecutar el stack: `docker compose -f infra/docker/docker-compose.yml up -d` desde la raíz del proyecto
- Inicializar BD demo: `Get-Content database\scripts\init_mun_demo.sql | docker exec -i sig_postgres psql -U sig_usuario -d sig_municipal`
- Configurar GeoServer: `.\geoserver\config\demo\configurar_demo.ps1` (requiere stack levantado)
- Hosts Windows para desarrollo: agregar `127.0.0.1  demo.localhost` en `C:\Windows\System32\drivers\etc\hosts`
- Seeds crean usuario `admin@sig.cl` / `Admin1234` (solo desarrollo)
- `unaccent()` es STABLE — no usar en columnas GENERATED ni en expresiones de índice; usar `to_tsvector('spanish', col)` para FTS
- El datastore GeoServer necesita host `sig_postgres` (nombre Docker), no `localhost`
