# Estado del proyecto SIG Municipal

## Última actualización: 2026-05-21

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

## ✅ Fase 2 — Panel de administración — COMPLETADA (2026-05-21)

### ✅ 2.1 Gestión de capas (FRONTEND_AGENT + BACKEND_AGENT)

#### Backend
- `services/capaService.js` — reescrito con columnas reales del esquema: `nombre_interno`, `nombre_visible`, `tipo`, `tabla_origen`, `url_wms`, `url_wfs`, `estilo_sld`, `visible_por_defecto`, `activo`, `orden`, `metadata`
- `obtenerCapasPublicas()` / `obtenerTodasLasCapas()` — queries corregidas; `categoria` y `descripcion` se extraen del JSONB `metadata`
- `actualizarActivoCapa(capaId, municipioId, activo)` — toggle con valor explícito
- `reordenarCapas(items, municipioId)` — bulk update via `unnest($1::uuid[], $2::integer[])`
- `publicarCapa()` — inserta con columnas reales; construye `url_wms`/`url_wfs` desde env; `_slugify()` para `nombre_interno`
- `routes/capas.js` — `PATCH /api/admin/capas/orden` registrado antes de `/:id`; logging de operaciones

#### Frontend
- `pages/AdminCapas.jsx` — tabla paginada, toggle activo/inactivo con optimistic update, drag & drop HTML5 nativo, modal "Publicar nueva capa" con previsualización WMS

#### Correcciones de esquema
- `public.capas` no tiene columnas `nombre`, `descripcion`, `visible_publico`, `workspace_geoserver` — todo alineado con migración 001
- `visible_por_defecto` (no `visible_publico`) es el campo equivalente

### ✅ 2.2 Gestión de usuarios y roles

#### Migración BD
- `database/migrations/005_roles_usuarios.sql` — renombra `password_hash` → `contrasena_hash`; actualiza roles `admin_municipio`→`admin_municipal`, `editor`→`editor_gis`, `visor`→`funcionario`; reemplaza CHECK constraint

#### Backend
- `services/usuarioService.js` — `obtenerUsuarios`, `obtenerUsuario`, `crearUsuario` (bcrypt 12 rondas, contraseña temporal auto-generada), `actualizarUsuario`, `toggleActivoUsuario`, `resetearContrasena`, `obtenerPerfil`, `actualizarPerfil`
- `routes/usuarios.js` — 8 rutas con guard anti-autodesactivación; registrado en `server.js`

#### Frontend
- `pages/AdminUsuarios.jsx` — tabla con badges de rol y estado, filtros, modal crear/editar, modal contraseña temporal con copiar al portapapeles

### ✅ 2.3 Onboarding de nuevo municipio

#### Backend
- `services/municipioService.js` — provisiona en transacción: `CREATE SCHEMA`, permisos `sig_app`, tablas espaciales desde template, INSERT en `public.municipios`; workspace GeoServer fuera de la transacción (fallo no revierte BD)
- `services/geoserverService.js` — función `crearDatastoreWorkspace(workspace, esquemaBd)` agregada
- `routes/superadmin.js` — `POST /api/superadmin/municipios` usa el servicio; devuelve `{ municipio, advertencias[] }`; agrega `GET /api/superadmin/municipios/:id`
- `backend/src/sql/template_municipio.sql` — copia del template dentro del contexto Docker del backend

#### Frontend
- `pages/OnboardingMunicipio.jsx` — formulario con auto-generación de `codigo` (slugify) y `subdominio`, selector visual de plan, estado de éxito con detalles y advertencias

### ✅ 2.4 Log de cambios

#### Backend
- `services/logService.js` — `registrarLog()` (no-fatal, fire-and-forget seguro), `obtenerLog()` (paginado con filtros dinámicos + JOIN a usuarios), `exportarLogCsv()` (hasta 10 000 entradas)
- `routes/log.js` — `GET /api/admin/log` y `GET /api/admin/log/exportar` (CSV con `Content-Disposition`)
- `routes/capas.js` — `registrarLog` tras publicar, toggle activo y reordenar
- `routes/usuarios.js` — `registrarLog` tras crear, editar, toggle estado y resetear contraseña

#### Frontend
- `pages/LogCambios.jsx` — tabla paginada con filtros (tabla, operación, fecha desde/hasta), badges coloreados, fila expandible con diff JSON (antes en rojo / después en verde), exportar CSV sin recargar

### ✅ 2.5 Dashboard admin

#### Backend
- `routes/stats.js` — `GET /api/admin/stats` (funcionario+): 7 subconsultas en paralelo — `capas_activas`, `total_capas`, `ultima_capa_actualizada`, `usuarios_activos`, `total_usuarios`, `reportes_pendientes`, `ultima_actividad`
- `routes/health.js` — extendido con `verificarGeoServer()` (timeout 3 s, Basic auth); BD + GeoServer verificados en paralelo; campo `geoserver` en la respuesta

#### Frontend
- `pages/Dashboard.jsx` — reescrito con: 4 tarjetas de métricas con skeleton de carga (capas, usuarios, reportes, última actividad en tiempo relativo); panel de estado del stack (puntos verde/rojo); accesos rápidos filtrados por rol; info del municipio con badge de plan
- `services/api.js` — `api.get` corregido para serializar `{ params }` como query string (corrige también LogCambios)

---

## 🔜 Fase 3 — Funcionalidades avanzadas (sem. 9–16)

### 3.1 Búsqueda predial (BACKEND_AGENT + FRONTEND_AGENT)

**Objetivo:** localizar predios por dirección (texto libre) o rol SII desde el mapa público y el panel admin.

**Backend**
- `GET /api/predios/buscar?q=&pagina=` — consulta `buscar_predios()` (FTS + ILIKE sobre `lower(unaccent(direccion))`); retorna `{ predios, total, pagina }`
- `GET /api/predios/:id` — detalle de un predio con todos sus atributos
- Parámetros opcionales: `bbox` (WGS84) para filtrar por extensión del mapa actual, `uso_suelo`, `activo`

**Base de datos**
- Verificar que `idx_mun_demo_predios_fts` y `idx_mun_demo_predios_dir_norm` estén creados en `mun_demo`
- Función `buscar_predios(esquema, termino, limite)` en migración 003 — ajustar firma si es necesario

**Frontend**
- `BuscadorPredial.jsx` — campo de búsqueda con debounce 300 ms, lista de resultados desplegable, click → centrar mapa + abrir `FichaPredio`
- `FichaPredio.jsx` — panel lateral con todos los atributos, rol SII, superficie, propietario, enlace a Google Maps
- Integración con `mapaStore`: al seleccionar un predio se ajusta el viewport y se resalta el polígono en el mapa

### 3.2 Módulo de reportes ciudadanos (BACKEND_AGENT + FRONTEND_AGENT)

**Objetivo:** formulario público para que ciudadanos reporten problemas urbanos con geolocalización; panel de gestión para funcionarios.

**Backend**
- `POST /api/reportes` — crea reporte (sin auth); valida geometría Point dentro del bbox del municipio; envía email de confirmación opcional
- `GET /api/admin/reportes` — lista paginada con filtros (estado, categoría, prioridad, rango de fechas, bbox)
- `PUT /api/admin/reportes/:id` — actualiza estado (`en_proceso`, `resuelto`, `rechazado`), asigna funcionario, registra resolución
- `GET /api/admin/reportes/:id` — detalle con historial de cambios

**Frontend (mapa público)**
- Botón flotante "Reportar problema" → formulario modal: tipo de problema (luminaria, bache, árbol, basura, semáforo, señalética, otro), descripción, foto opcional, nombre/email de contacto
- Click en el mapa para ubicar el punto o usar geolocalización del navegador

**Frontend (panel admin)**
- `pages/AdminReportes.jsx` — tabla con filtros, mapa mini con pins de reportes, detalle lateral con actualización de estado inline

### 3.3 Integración con IDE Chile (GIS_AGENT + BACKEND_AGENT)

**Objetivo:** agregar capas WMS nacionales del IDE Chile como fuentes externas sin necesidad de almacenamiento local.

**Capas prioritarias**
- Límites administrativos (comunas, regiones) — `www.ide.cl/geoserver/wms`
- Red hidrográfica (ríos, lagos)
- Red vial nacional
- Uso de suelo CONAF

**Backend**
- `GET /api/capas/ide-chile` — lista de capas IDE disponibles (catálogo estático con metadata)
- `POST /api/admin/capas/ide` — registra una capa IDE en `public.capas` con `url_wms` apuntando a IDE; no usa GeoServer

**Frontend**
- Selector "Agregar capa IDE Chile" en `AdminCapas.jsx` — muestra catálogo, preview WMS en miniatura, botón añadir
- Las capas IDE aparecen en `ControlCapas.jsx` con indicador de fuente externa

### 3.4 Dashboard analytics por municipio (FRONTEND_AGENT + BACKEND_AGENT)

**Objetivo:** métricas de uso para el administrador municipal.

**Backend**
- Middleware de tracking: registra en `log_cambios` las consultas a capas WMS (operación `VIEW`) con timestamp y bbox consultado
- `GET /api/admin/analytics` — agrega por período (día/semana/mes): visitas únicas estimadas, capas más consultadas, reportes por zona (hexbin o por sector)

**Frontend**
- Sección "Analytics" en el Dashboard o página dedicada `pages/Analytics.jsx`
- Gráfico de barras (visitas por día, últimos 30 días) — librería `recharts` o `chart.js`
- Ranking de capas más consultadas
- Mapa de calor de reportes por zona

---

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
- Seeds crean usuario `admin@sig.cl` / `Admin1234` (solo desarrollo); `municipio@demo.sig.cl` / `Admin1234` para admin_municipal
- `unaccent()` es STABLE — no usar en columnas GENERATED ni en expresiones de índice; usar `to_tsvector('spanish', col)` para FTS
- El datastore GeoServer necesita host `sig_postgres` (nombre Docker), no `localhost`
- Migraciones deben ejecutarse en orden: 002 → 001 → 003 → 004 → 005 (002 instala PostGIS, que 001 requiere para la columna geometry de reportes_ciudadanos)
- `registrarLog()` en logService.js es no-fatal: si falla escribe al logger del proceso pero no propaga el error
- `api.get(ruta, { params })` serializa params como query string (corregido en 2.5)
