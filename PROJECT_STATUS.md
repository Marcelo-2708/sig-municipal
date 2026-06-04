# Estado del proyecto SIG Municipal

## Última actualización: 2026-06-03

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

## ✅ Fase 2.6 — Capas reales en el mapa demo — COMPLETADA (2026-05-22)

Migración del mapa público de capas de ejemplo a datos reales importados desde shapefiles.
Capas servidas desde GeoServer local (PostGIS `mun_demo`), no desde WMS externo.

### Datos

- Shapefiles importados a PostGIS vía `shp2pgsql` dentro del contenedor `sig_postgres`:
  - `mun_demo.inacap_ccp_thno` — puntos INACAP Concepción-Talcahuano (MULTIPOINT, EPSG:32718)
  - `mun_demo.eem_idoneos` — puntos EEM Idóneos (MULTIPOINT, EPSG:32718)
- Script de importación: `docker cp` + `shp2pgsql -s 32718 -I` dentro del contenedor
- `database/scripts/reemplazar_capas_demo.sql` — elimina capas placeholder e inserta las reales en `public.capas`

### GeoServer

- Workspace `demo` + datastore `demo_postgis` (host `sig_postgres`, esquema `mun_demo`) creados vía REST API
- Capas publicadas con `nativeCRS: EPSG:32718 → srs: EPSG:4326` (`projectionPolicy: REPROJECT_TO_DECLARED`)
- BBox recalculado desde los datos reales (`?recalculate=nativebbox,latlonbbox`)
- `geoserver/config/demo/publicar_capas_demo.ps1` — script idempotente (verifica antes de crear); reemplaza `configurar_demo.ps1` para esta fase

### Backend

- `services/capaService.js` — `obtenerCapasPublicas()` retorna `nombre_capa_wms` desde JSONB metadata
- `routes/capas.js` — schema `/api/capas/publicas` incluye `nombre_capa_wms`
- `public.capas` actualizado: `tabla_origen` = nombre de tabla PostGIS; `url_wms` = URL interna GeoServer; `metadata.nombre_capa_wms` = `demo:inacap_ccp_thno` / `demo:eem_idoneos`

### Frontend — mapa base

- `SelectorMapaBase.jsx` eliminado — el fondo es fijo, definido por proyecto
- `config/mapas.js` simplificado: exporta `ESTILO_MAPA_BASE` (OSM Mapnik) + `CENTRO_INICIAL`/`ZOOM_INICIAL`; eliminados `MAPAS_BASE` y `MAPA_BASE_DEFECTO`
- `store/mapaStore.js` — eliminados `mapaBaseActivo` y `setMapaBase`
- `MapaBase.jsx` — usa `ESTILO_MAPA_BASE` fijo; eliminado `useEffect` de cambio de estilo
- Centro inicial: `[-73.12, -36.633]` (WGS84, área del proyecto Concepción); zoom 14

### Frontend — capas WMS y GetFeatureInfo

- `services/mapaUtils.js`:
  - `construirUrlWMS` reescrita como string literal — `URLSearchParams` codificaba `:` → `%3A` (rompía `demo:capa` en GeoServer) y `{` → `%7B` (rompía `{bbox-epsg-3857}` de MapLibre)
  - `agregarCapaWMS` diferencia capas GeoServer (`tabla_origen` != '') de WMS externas; usa `nombre_capa_wms` para el parámetro `LAYERS`
- `hooks/useGetFeatureInfo.js` — nuevo; consulta WMS GetFeatureInfo al hacer click en el mapa:
  - Capas GeoServer local: endpoint `/geoserver/wms` (accesible via Nginx); query string literal (mismo fix de codificación)
  - Capas externas: `capa.url_wms` directo
  - Timeout 8 s; cursor `wait` durante carga; fallo por capa no cancela las demás
- `components/mapa/PanelFeatureInfo.jsx` — nuevo; panel derecho con atributos por capa/feature; filtra campos internos GIS (`objectid`, `gid`, `geometry`, etc.); tarjetas colapsables
- `pages/MapaPublico.jsx` — integra `useGetFeatureInfo` + `PanelFeatureInfo`; oculta `FichaPredio` cuando GFI está activo

---

## ✅ Fase 2.7 — Tenant Vichuquén + configuración per-tenant — COMPLETADA (2026-05-28)

Alta del municipio piloto real (Vichuquén, Maule) como segundo tenant del sistema.
Implementación de configuración de mapa por municipio (fondo, centro, zoom) leída desde la BD.

### Datos y GeoServer

- Schema `mun_vichuquen` ya existía en PostgreSQL con 4 tablas importadas desde shapefiles:
  - `mun_vichuquen.censo` — manzanas censales Censo INE 2017 (EPSG:32719)
  - `mun_vichuquen.red_vial` — red vial (EPSG:32719)
  - `mun_vichuquen.amenaza` — zonas de amenaza natural (EPSG:32719)
  - `mun_vichuquen.hogares` — hogares (EPSG:32719)
- `geoserver/config/vichuquen/publicar_capas_vichuquen.ps1` — script PowerShell idempotente:
  - Crea workspace `vichuquen` + namespace en GeoServer REST API
  - Crea datastore `vichuquen_postgis` (host `sig_postgres`, esquema `mun_vichuquen`)
  - Publica las 4 capas con `nativeCRS: EPSG:32719 → srs: EPSG:4326` (`REPROJECT_TO_DECLARED`)
  - Recalcula bbox desde datos reales en cada capa
  - Usa string literal para JSON (no here-strings — incompatibles con PS 5.1 en este entorno)

### Base de datos

- `database/scripts/init_mun_vichuquen.sql` — script idempotente (`ON CONFLICT DO NOTHING`):
  - Inserta `vichuquen` en `public.municipios` (id fijo `00000000-0000-0000-0000-000000000002`, subdominio `vichuquen`, región Maule, provincia Curicó, plan básico)
  - Registra las 4 capas en `public.capas` con `tabla_origen`, `url_wms` interna y `metadata.nombre_capa_wms`
  - `censo` y `red_vial` visibles por defecto; `amenaza` oculta por defecto (visible en admin); `hogares` visible por defecto
- `municipios.config` — nuevo campo activo: guarda configuración de mapa por tenant:
  ```json
  {"mapa": {"centro": [-71.97, -34.87], "zoom": 13, "fondo": "esri_imagery"}}
  ```

### Backend — endpoint `/api/tenant/info`

- `backend/src/routes/tenant.js` — nuevo; `GET /api/tenant/info` sin autenticación:
  - Retorna `{ id, codigo, nombre, config }` del tenant activo
  - `config` incluye el campo `mapa` con fondo, centro y zoom
- `backend/src/middleware/tenant.js` — query de resolución ahora incluye `config` en el `SELECT`; `request.tenant.config` disponible en todas las rutas
- `backend/server.js` — registra `rutasTenant`
- El frontend ya llamaba este endpoint (`useTenant` → React Query) — ahora tiene respuesta real con configuración

### Frontend — mapa configurable por tenant

- `frontend/src/config/mapas.js`:
  - `FONDOS_MAPA` — objeto con estilos MapLibre por clave: `osm` (OpenStreetMap Mapnik) y `esri_imagery` (ESRI World Imagery satelital)
  - `resolverEstiloFondo(idFondo)` — retorna el estilo correspondiente o OSM como fallback
  - `ESTILO_MAPA_BASE` mantenido como alias de `FONDOS_MAPA.osm` para compatibilidad
- `frontend/src/components/mapa/MapaBase.jsx`:
  - Acepta prop `configMapa?: { centro, zoom, fondo }` 
  - Usa `resolverEstiloFondo(configMapa?.fondo)`, `configMapa?.centro`, `configMapa?.zoom` con fallback a constantes
- `frontend/src/pages/MapaPublico.jsx`:
  - Lee `cargando` (renombrado `tenantCargando`) de `useTenant`
  - Pasa `municipio.config.mapa` como `configMapa` a `MapaBase`
  - **Fix de race condition**: `MapaBase` se monta sólo cuando `!tenantCargando` — evita que el `useEffect` de inicialización (dependencias `[]`) corra con `configMapa = undefined` antes de que `/api/tenant/info` responda

### Notas técnicas de esta fase

- Tablas de Vichuquén en **EPSG:32719** (UTM 19S) — diferente a las del tenant demo (EPSG:32718, UTM 18S)
- `municipios.config` es JSONB libre — cualquier clave puede agregarse sin migración de esquema
- La race condition del mapa (fondo incorrecto en carga inicial) se debe a que `MapaBase` inicializa el mapa una sola vez con `useEffect` de deps `[]`. Solución: diferir el mount del componente hasta que la config esté disponible. No usar `configMapa` en las deps del effect (causaría re-creación del mapa)
- URLs WMS internas Docker (`http://sig_geoserver:8080/...`) van en `public.capas.url_wms`; el frontend usa `GEOSERVER_URL` (proxiado por Nginx) para las llamadas reales al navegador
- `obtenerCapasPublicas()` filtra por `visible_por_defecto = true AND activo = true` — `amenaza` no aparece en el mapa público aunque sí en el panel admin

---

## ✅ Fase 2.8 — Panel censal de hogares y mejoras UI — COMPLETADA (2026-05-30)

### GeoServer — capa hogares en Vichuquén

- `geoserver/config/vichuquen/publicar_capas_vichuquen.ps1` — agregada capa `hogares` al array `$CAPAS`:
  - `nativeCRS: EPSG:32719 → srs: EPSG:4326` (`REPROJECT_TO_DECLARED`), igual que el resto de capas del tenant
  - Script pasa de publicar 3 capas a 4 (censo, red_vial, amenaza, hogares)

### Frontend — Panel censal de manzanas (PanelCensalHogares)

**`mapaStore.js`** — nuevos campos de estado:
- `manzanaSeleccionada: null` — propiedades del feature clickeado + `_num`, `_x`, `_y`
- `setManzanaSeleccionada(datos)` — abre el panel censal
- `clickBloqueado: false` — flag síncrono que bloquea `useGetFeatureInfo` cuando un click fue procesado por la capa hogares
- `setClickBloqueado(valor)` — activa/desactiva el bloqueo
- `limpiarMapa()` actualizado para limpiar `manzanaSeleccionada` y `clickBloqueado`

**`hooks/useHogaresInteractivo.js`** — reescrito:
- En lugar de crear un `maplibregl.Popup`, llama a `setManzanaSeleccionada({ ...props, _num, _x, _y })` al hacer click
- Click en punto (`LYR_PTS`) y click en polígono con datos (`LYR_POLY`) llaman `setClickBloqueado(true)` antes de abrir el panel
- Coordenadas de pixel `e.point.x / e.point.y` guardadas en `manzanaSeleccionada` para posicionar el panel near-click
- `circle-radius` cambiado de valor fijo a expresión MapLibre proporcional a `n_hog`:
  - `n_hog ≤ 4` → radio 8 px
  - `n_hog ≤ 9` → radio 12 px
  - `n_hog ≤ 16` → radio 16 px
  - `n_hog ≥ 17` → radio 22 px
- Colores de polígonos actualizados a 4 rangos coherentes con el tamaño de los puntos: `#ffe4e6 / #fca5a5 / #ef4444 / #b91c1c`

**`hooks/useGetFeatureInfo.js`** — guarda de click bloqueado:
- Al inicio del handler de click lee `useMapaStore.getState().clickBloqueado`
- Si `true` → resetea a `false` y retorna sin consultar GFI
- Usa `getState()` (no estado reactivo) porque el handler es un closure estático registrado en `mapa.on('click')`

**`components/mapa/PanelCensalHogares.jsx`** — reescrito completo:
- Lee `manzanaSeleccionada` y `setManzanaSeleccionada` desde `mapaStore` — no recibe props
- **Posición dinámica**: aparece a 15px a la derecha del punto clickeado; si `px > window.innerWidth - 315` aparece a la izquierda (previene salida de pantalla); `top = max(8, py - 50)`; usa `style={{ position: 'absolute', left, top }}` en lugar de clases Tailwind fijas
- **Cabecera**: gradiente `linear-gradient(135deg, #1d4ed8 → #1e3a8a)`, dos líneas: "Manzana N" + "Vichuquén", botón X
- **Gráfico canvas** 120×120 px: sector azul `#1565C0` (hombres) + sector magenta `#E91E8C` (mujeres) + borde blanco 3px; leyenda con iconos ♂ ♀, porcentajes
- **Datos en grid 2 columnas** (tarjetas `bg-gray-50 rounded-lg`): Total personas, Total hogares, Hombres, Mujeres, Edad promedio, Escolaridad (N años), Localidad (col-span-2)
- Ancho fijo 300 px, `shadow-2xl`, `rounded-xl`, sin scroll

**`components/mapa/MapaBase.jsx`** — integración:
- Importa y llama `useHogaresInteractivo(mapaRef, capasActivas, GEOSERVER_URL)` — los puntos y eventos de hogares se gestionan desde aquí

**`pages/MapaPublico.jsx`** — renderizado:
- Importa y renderiza `<PanelCensalHogares />` junto a `<FichaPredio />` (el panel se autogestiona via store)

### Frontend — mejoras de UI globales

**Navbar superior (`MapaPublico.jsx`)**:
- Eliminado `md:left-72` — causaba que el header apareciera "cortado" desde la izquierda en pantallas medianas
- Ícono de ubicación encerrado en `div` con `bg-municipal-700` para consistencia visual
- Título en dos líneas: "SIG MUNICIPAL" (caps tracking-widest, oculto en móvil) + nombre del municipio con `truncate`
- `flex-shrink-0` en el botón "Ingresar" para que nunca se comprima
- `shadow-sm` + `bg-white/90 backdrop-blur-md`

**Panel de capas (`ControlCapas.jsx`)**:
- Se posiciona él mismo con `absolute top-16 left-4 z-controles`; eliminado el wrapper `<div>` en `MapaPublico`
- `w-[260px]`, `bg-white/95 backdrop-blur-sm`, `shadow-2xl`, `rounded-xl`, `border border-gray-100`
- **Íconos SVG inline** de tipo de geometría detectado por `tipo_geometria` o heurística sobre `nombre_interno`:
  - Polígono → hexágono azul (`text-blue-500`)
  - Línea → polilínea ámbar (`text-amber-500`)
  - Punto → círculo verde (`text-emerald-500`)
  - Default → ícono de capas gris
- **Toggle switch** accesible (`role="switch"`, `aria-checked`) en lugar de `<input type="checkbox">`; animación CSS `translate-x`
- **Cabecera** con contador activas/total `(2/5)`, botón colapsar con rotación 180°
- **Separador `border-t`** entre grupos de categorías (excepto el primero)
- Encabezados de categoría en uppercase tracking-wider gris, con conteo entre paréntesis
- Slider de opacidad solo cuando la capa está activa; `accent-municipal-600`

### Notas técnicas de esta fase

- `useGetFeatureInfo` usa `useMapaStore.getState()` (API imperativa de Zustand) en lugar de estado reactivo para leer `clickBloqueado` en el momento exacto del evento — los closures registrados en `mapa.on('click')` no tienen acceso a estado React actualizado
- El panel `PanelCensalHogares` no usa `position: absolute` de Tailwind porque necesita valores computados en JS; usa `style={{ position: 'absolute', left, top, width: 300 }}`
- `circle-radius` con expresión `case` de MapLibre es más simple y estable que `symbol` + `addImage` — intentar `addImage` con imágenes de distinto tamaño produce error "mismatched image size" en MapLibre (todas las imágenes de un symbol layer deben tener las mismas dimensiones)

---

## ✅ Fase 2.9 — Panel de amenaza + acceso externo por ngrok — COMPLETADA (2026-06-03)

### Frontend — Panel especializado para la capa "amenaza"

**`hooks/useGetFeatureInfo.js`** — posición del click exportada:
- Nuevo estado `clickPos: null` — se setea con `{ x: e.point.x, y: e.point.y }` al inicio de cada handler de click
- `cerrar()` también resetea `clickPos` a `null`
- Retorna `clickPos` junto a `resultados`, `cargando`, `error` y `cerrar`

**`components/mapa/PanelAmenaza.jsx`** — nuevo componente especializado:
- Props: `resultado` (item `{ capa, features }` de la capa amenaza), `clickPos`, `cerrar`
- **Posición dinámica**: misma lógica que `PanelCensalHogares` — aparece a 15 px a la derecha del click; si `px > window.innerWidth - 315` aparece a la izquierda; `top = max(8, py - 50)`; usa `style={{ position: 'absolute', left, top, width: 300 }}`
- **Cabecera**: gradiente `#1d4ed8 → #1e3a8a`, dos líneas: "Vichuquén" + "Zona de Amenaza", botón X
- **Badge de nivel** por `gridcode`:
  - `1` → "Baja" (verde: `bg-green-100 text-green-700`)
  - `2` → "Media" (naranja: `bg-orange-100 text-orange-700`)
  - `3` → "Alta" (rojo: `bg-red-100 text-red-700`)
  - Otro → "Código N" (gris, fallback defensivo)
- **Filtro de campos internos**: elimina `ogc_fid`, `qc_id`, `id`, `objectid`, `gridcode` y cualquier campo que empiece con `shape_`; muestra campos restantes en grid 2 columnas
- Ídem estilo que `PanelCensalHogares`: `shadow-2xl`, `rounded-xl`, `border border-blue-100`, ancho 300 px

**`pages/MapaPublico.jsx`** — enrutamiento de resultados GFI:
- Importa `PanelAmenaza`
- Destructura `clickPos` (renombrado `featureClickPos`) desde `useGetFeatureInfo`
- Separa resultados: `resultadoAmenaza = featureResultados?.find(r => r.capa.nombre_interno === 'amenaza')` y `resultadosResto = featureResultados?.filter(...)`
- `PanelAmenaza` recibe `resultadoAmenaza` + `featureClickPos` + `cerrarFeatureInfo`
- `PanelFeatureInfo` recibe solo `resultadosResto` (sin amenaza); su prop `error` es `null` cuando amenaza está mostrando panel (evita doble mensaje de error)
- Cuando solo hay resultado de amenaza, `PanelFeatureInfo` retorna `null` sin mostrar nada extra

### Infraestructura — Acceso externo por ngrok

**`infra/nginx/sites/municipios.conf`** — nuevo bloque `default_server`:
- `listen 80 default_server` + `server_name _` captura cualquier `Host` que no coincida con `*.localhost`:
  - URLs de ngrok (`abc123.ngrok-free.app`)
  - Acceso directo por IP
  - Cualquier dominio externo no configurado
- Fuerza `proxy_set_header X-Municipio vichuquen` — el middleware `tenant.js` del backend resuelve el tenant desde esta cabecera; el bloque siempre sirve el municipio piloto Vichuquén
- Mismas `location` blocks que el bloque de desarrollo: `/api/`, `/geoserver/web/` (bloqueado 403), `/geoserver/`, `/`
- Bloque agregado entre el server block de desarrollo y los bloques de producción comentados

### Notas técnicas de esta fase

- `PanelAmenaza` y `PanelFeatureInfo` comparten `cerrar` (es la misma función `cerrarFeatureInfo`) — cerrar cualquiera de los dos limpia todos los resultados del GFI incluyendo `clickPos`
- El `default_server` de Nginx no requiere que el `Host` sea un subdominio conocido; `server_name _` es el patrón comodín estándar de Nginx para el bloque fallback
- El bloque de desarrollo `*.localhost` sigue teniendo prioridad sobre el `default_server` para accesos locales — Nginx evalúa los bloques en orden y hace match exacto/regex antes que el default

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

### Arranque del stack
- Ejecutar el stack: `docker compose -f infra/docker/docker-compose.yml up -d` desde la raíz del proyecto
- Hosts Windows para desarrollo: agregar `127.0.0.1  demo.localhost` en `C:\Windows\System32\drivers\etc\hosts`
- Seeds crean usuario `admin@sig.cl` / `Admin1234` (solo desarrollo); `municipio@demo.sig.cl` / `Admin1234` para admin_municipal

### GeoServer
- Publicar capas demo (idempotente): `.\geoserver\config\demo\publicar_capas_demo.ps1` — reemplaza `configurar_demo.ps1`
- El datastore GeoServer necesita host `sig_postgres` (nombre Docker interno), no `localhost`
- El parámetro `LAYERS` del WMS global requiere prefijo de workspace: `demo:inacap_ccp_thno`
- **No usar `URLSearchParams` para construir URLs WMS** — codifica `:` → `%3A` y `{` → `%7B`; usar string literal directo
- GeoServer GetFeatureInfo es accesible desde el browser via `/geoserver/wms` (Nginx proxy), no via la URL Docker interna

### Importación de shapefiles
- Método: `docker cp archivo.shp sig_postgres:/tmp/` + `shp2pgsql -s SRID_ORIGEN:4326 -I`
- Shapefiles del proyecto en EPSG:32718 (UTM 18S) — reproyectados a EPSG:4326 en GeoServer (`REPROJECT_TO_DECLARED`)
- Ver `database/scripts/reemplazar_capas_demo.sql` para estructura de inserción en `public.capas`

### Base de datos
- Inicializar BD demo: `docker exec -i sig_postgres psql -U sig_usuario -d sig_municipal < database\scripts\init_mun_demo.sql`
- Migraciones en orden: 002 → 001 → 003 → 004 → 005 (002 instala PostGIS, requerido por 001)
- `unaccent()` es STABLE — no usar en columnas GENERATED ni índices; usar `to_tsvector('spanish', col)` para FTS

### Backend / Frontend
- `registrarLog()` en logService.js es no-fatal: si falla escribe al logger pero no propaga el error
- `api.get(ruta, { params })` serializa params como query string (corregido en 2.5)
- `tabla_origen` nulo/vacío en `public.capas` = capa WMS externa; no nulo = servida desde GeoServer local
- `metadata.nombre_capa_wms` almacena el nombre real del parámetro `LAYERS` (incluye prefijo de workspace para GeoServer)
- `municipios.config` JSONB guarda configuración per-tenant; clave `mapa` con `{ centro, zoom, fondo }` usada por el frontend
- `resolverEstiloFondo(idFondo)` en `config/mapas.js` convierte el ID de fondo a objeto de estilo MapLibre; fallback a OSM
- **Race condition mapa base**: `MapaBase` usa `useEffect` con deps `[]` (se ejecuta una sola vez al montar). Si `configMapa` llega después (async), el mapa ya fue inicializado con defaults. Fix: diferir el mount de `MapaBase` hasta que `tenantCargando === false` en `MapaPublico`
- Agregar nuevo tenant: (1) SQL `init_mun_X.sql`, (2) `publicar_capas_X.ps1`, (3) hosts file + `municipios.config` con config de mapa

### Panel censal de hogares
- `PanelCensalHogares` lee directamente de `mapaStore` — no necesita props; se renderiza en `MapaPublico` junto a `FichaPredio`
- Posición near-click: coordenadas `e.point.x / e.point.y` viajan en `manzanaSeleccionada._x / ._y`; detección de desborde por la derecha con `window.innerWidth - 315`
- `useGetFeatureInfo` usa `useMapaStore.getState()` (API imperativa de Zustand) para leer `clickBloqueado` en el closure del evento — el estado reactivo de React no está disponible en handlers registrados via `mapa.on('click')`
- `circle-radius` con expresión `case` de MapLibre GL es la forma correcta de escalar puntos proporcionalmente; usar `symbol` + `addImage` con canvas de distintos tamaños produce error "mismatched image size" (MapLibre exige mismo tamaño para todas las imágenes de un symbol layer)

### UI / Navbar
- El `md:left-72` en el `<header>` de `MapaPublico` desplazaba el navbar 288 px desde la izquierda en pantallas medianas, causando apariencia de "cortado". Eliminado — el panel de capas está en `top-16` y no se superpone con el header
- `ControlCapas` se posiciona a sí mismo con `absolute`; no necesita wrapper en el padre
