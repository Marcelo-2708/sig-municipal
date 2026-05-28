# SIG Municipal — Instrucciones maestras para agentes Claude Code

> **Leer este archivo completo antes de escribir cualquier línea de código.**
> Este documento es la fuente de verdad del proyecto. En caso de contradicción
> con cualquier otro archivo del repo, este documento tiene prioridad.
> Última actualización: 2026-05-27

---

## 1. Qué es este proyecto

Plataforma WebGIS **multi-tenant SaaS** para municipalidades chilenas. Un solo sistema
aloja múltiples municipios aislados entre sí. Cada municipio accede por su subdominio
(`demo.localhost`, `vichuquen.localhost`, y en producción `sig.vichuquen.cl`).

El equipo técnico municipal publica capas desde QGIS hacia GeoServer. Ciudadanos y
funcionarios consultan el mapa web en el navegador, sin instalar nada.

**Cliente piloto activo:** Municipio de Vichuquén, Región del Maule.
**Tenant en sistema:** `mun_vichuquen` (schema PostgreSQL) / workspace GeoServer `vichuquen`.

### Por qué multi-tenant (no instancia por municipio)

- Un solo deploy para todos los clientes — bugfixes y features llegan a todos al mismo tiempo.
- Onboarding de nuevo municipio ya implementado: formulario → script SQL → workspace GeoServer.
- Aislamiento de datos garantizado por schema PostgreSQL separado por municipio.
- Con 2 desarrolladores, mantener N instancias separadas no escala.

---

## 2. Estado actual del proyecto

| Fase | Estado | Completada |
|------|--------|------------|
| Fase 1 — Fundación (Docker, BD, API base, Frontend base) | ✅ COMPLETA | 2026-05-02 |
| Fase 2 — Panel de administración (capas, usuarios, onboarding, logs) | ✅ COMPLETA | 2026-05-21 |
| Fase 3 — Funcionalidades avanzadas | 🔜 EN CURSO | — |
| Fase 4 — Producción y escala | 🔜 PENDIENTE | — |

**El agente NO debe reimplementar nada de las Fases 1 y 2.**
Antes de crear cualquier archivo, verificar si ya existe en el repo.

---

## 3. Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend API | Node.js + **Fastify** | Node 20 LTS |
| Frontend | React 18 + Vite 5 + MapLibre GL JS 4 | — |
| Estado global | Zustand + React Query v5 | — |
| Estilos | Tailwind CSS | — |
| Gráficos | Recharts | — |
| Base de datos | PostgreSQL 16 + PostGIS 3.4 | — |
| Servidor de mapas | GeoServer 2.25 | — |
| Infraestructura | Docker Compose + Nginx | — |

> ⚠️ El backend usa **Fastify**, no Express. No cambiar el framework ni sugerir
> migrarlo. Todo código nuevo de backend debe usar Fastify y sus convenciones.

---

## 4. Arquitectura del sistema

```
Navegador (subdominio municipio)
        │
        ▼
   Nginx (proxy inverso)
   *.localhost / *.sig.cl
        │
   ┌────┴────────────────┐
   ▼                     ▼
Frontend React        Backend Fastify
(Vite 5)             :3000
MapLibre GL JS             │
        │             ┌────┴────────────────┐
        │             ▼                     ▼
        │        PostgreSQL           GeoServer
        │        + PostGIS            :8080
        │        :5432                WMS / WFS
        │             │
        └─────────────┘
         WMS/WFS directo
         desde MapLibre
```

### Reglas de arquitectura que el agente debe respetar

1. **Multi-tenancy por schema**: cada municipio tiene su schema `mun_{codigo}` en PostgreSQL.
   El middleware `tenant.js` resuelve el schema activo a partir del subdominio del request.
2. **GeoServer por workspace**: cada municipio tiene su workspace `{codigo}` en GeoServer.
3. **Frontend nunca llama directamente a PostGIS**. Toda consulta de datos pasa por
   la API Fastify o por WMS/WFS de GeoServer.
4. **Sin credenciales hardcodeadas**. Siempre variables de entorno desde `.env`.
5. **Logs estructurados** en toda operación crítica del backend.
6. **Manejo explícito de errores** — nunca `catch` vacío.

---

## 5. Estructura de carpetas

```
sig-municipal/
├── agents/              # Instrucciones por agente (este directorio)
├── backend/             # API REST (Fastify)
│   └── src/
│       ├── config/      # env.js, database.js (pool pg + search_path por tenant)
│       ├── middleware/  # tenant.js, auth.js, rateLimit.js, errorHandler.js
│       ├── routes/      # health, auth, capas, predios, reportes, superadmin, stats, log, usuarios
│       ├── services/    # authService, capaService, predioService, reporteService,
│       │                # geoserverService, municipioService, usuarioService, logService
│       └── sql/         # template_municipio.sql
├── frontend/            # Vite 5 + React 18
│   └── src/
│       ├── components/
│       │   ├── mapa/    # MapaBase, ControlCapas, BuscadorPredial, FichaPredio, SelectorMapaBase
│       │   └── ui/      # Componentes reutilizables
│       ├── pages/       # MapaPublico, Login, Dashboard, AdminCapas, AdminUsuarios,
│       │                # OnboardingMunicipio, LogCambios
│       ├── store/       # authStore (localStorage), mapaStore (Zustand)
│       └── services/    # api.js (refresco JWT automático), mapaUtils.js
├── database/
│   ├── migrations/      # 001–005 (ejecutar en orden: 002→001→003→004→005)
│   ├── seeds/
│   └── scripts/         # crear_municipio.sql, init_mun_demo.sql, health_check.sql
├── geoserver/
│   ├── config/demo/     # workspace, datastore, layer, GWC, configurar_demo.ps1
│   └── estilos/         # SLD por municipio
├── infra/
│   ├── docker/          # docker-compose.yml, docker-compose.prod.yml
│   └── nginx/           # nginx.conf, sites/municipios.conf
└── docs/                # Documentación técnica
```

---

## 6. Convenciones obligatorias (todos los agentes)

- **Comentarios y logs en español**
- **Nombres de variables, funciones y archivos en inglés** (convención técnica)
- **UI 100% en español** — el usuario final es funcionario municipal chileno
- Sin credenciales hardcodeadas — siempre `.env`
- Manejo explícito de errores; nunca `catch` vacío
- Logs estructurados en cada operación crítica
- Tests para funciones de negocio críticas
- Commits en español, formato: `tipo(scope): descripción`
  - Ejemplos: `feat(mapa): agregar panel censal`, `fix(backend): corregir query de predios`
- TypeScript en frontend: tipado estricto, sin `any` salvo en adaptadores documentados
- Cada hook y componente React debe tener comentario de bloque inicial en español

---

## 7. Agentes disponibles

| Agente | Archivo | Responsabilidad |
|--------|---------|----------------|
| `ORCHESTRATOR` | `agents/ORCHESTRATOR.md` | Planifica, divide tareas, coordina agentes |
| `DATABASE_AGENT` | `agents/DATABASE_AGENT.md` | Schemas PostgreSQL/PostGIS, migraciones, índices |
| `BACKEND_AGENT` | `agents/BACKEND_AGENT.md` | API REST Fastify, rutas, middleware, auth JWT |
| `FRONTEND_AGENT` | `agents/FRONTEND_AGENT.md` | React, MapLibre, componentes, UI/CSS |
| `GIS_AGENT` | `agents/GIS_AGENT.md` | GeoServer, WMS/WFS, estilos SLD, capas |
| `DEVOPS_AGENT` | `agents/DEVOPS_AGENT.md` | Docker, Nginx, subdominios, SSL, CI/CD |

---

## 8. Comandos esenciales de desarrollo

```bash
# Levantar stack completo
docker compose -f infra/docker/docker-compose.yml up -d

# Inicializar BD demo (Windows PowerShell)
Get-Content database\scripts\init_mun_demo.sql | docker exec -i sig_postgres psql -U sig_usuario -d sig_municipal

# Inicializar BD demo (Linux/Mac)
cat database/scripts/init_mun_demo.sql | docker exec -i sig_postgres psql -U sig_usuario -d sig_municipal

# Configurar GeoServer (requiere stack levantado)
.\geoserver\config\demo\configurar_demo.ps1

# Hosts Windows para desarrollo local
# Agregar en C:\Windows\System32\drivers\etc\hosts:
# 127.0.0.1  demo.localhost
# 127.0.0.1  vichuquen.localhost

# Credenciales de desarrollo (solo dev, nunca producción)
# admin@sig.cl / Admin1234  →  superadmin
# municipio@demo.sig.cl / Admin1234  →  admin_municipal del tenant demo
```

---

## 9. Notas técnicas críticas — leer antes de tocar BD o GeoServer

Estas son lecciones aprendidas en las Fases 1 y 2. Ignorarlas causa bugs difíciles de depurar.

### PostgreSQL / PostGIS

- **Orden de migraciones**: `002 → 001 → 003 → 004 → 005`
  La migración 002 instala PostGIS, que la 001 requiere para la columna `geometry` de `reportes_ciudadanos`.
- **`unaccent()` es STABLE, no IMMUTABLE**: no usar en columnas `GENERATED ALWAYS AS`
  ni en expresiones de índice directas. Para búsqueda de texto usar `to_tsvector('spanish', col)`.
- **Índices FTS**: usar `to_tsvector('spanish', direccion)` — expresión IMMUTABLE válida.
- **`registrarLog()`** en `logService.js` es no-fatal (fire-and-forget): si falla escribe
  al logger del proceso pero no propaga el error. No envolver en try/catch adicional.
- **`api.get(ruta, { params })`** serializa params como query string — ya corregido en 2.5.
  Mantener esa convención en nuevas rutas.
- **Schema por tenant**: el middleware `tenant.js` resuelve el schema activo vía `search_path`.
  Toda query de backend opera sobre el schema del tenant actual automáticamente.

### GeoServer

- **Host del datastore**: usar `sig_postgres` (nombre del servicio Docker), nunca `localhost`.
- **CORS**: habilitado para `http://localhost:5173` en desarrollo. En producción agregar
  el dominio del municipio correspondiente.
- **Idempotencia**: el script `configurar_demo.ps1` usa POST/PUT con retry — siempre hace
  PUT si el datastore ya existe para corregir configuraciones previas incorrectas.
- **GWC (GeoWebCache)**: habilitado por capa para mejorar rendimiento de tiles.

### Frontend / MapLibre

- El mapa se inicializa en `useEffect` y se limpia al desmontar. **Nunca re-crear el mapa
  en cada render**.
- El `mapRef` vive en el contexto `MapProvider` — cualquier componente accede al mapa
  vía `useMap()`, sin prop-drilling.
- WMS para visualización (tiles de imagen), WFS para consulta de atributos al hacer clic.

---

## 10. Fase 3 — Prioridades y contexto del cliente piloto

### Cliente piloto: Municipio de Vichuquén

**Datos disponibles**: capas del Censo INE 2017 con ~200 atributos sociodemográficos
por manzana censal. Los datos vienen de QGIS Cloud Free del cliente.

**Restricción QGIS Cloud Free**: no expone WFS público confiable. El flujo correcto es:
```
QGIS Cloud → Exportar SHP/GeoJSON → ogr2ogr → PostGIS (mun_vichuquen) → GeoServer publica → Frontend consume
```

**Capas confirmadas**:
- `manzanas_censales` — polígonos con atributos del Censo 2017 (ver sección 11)
- `vias` — líneas de red vial. Atributos por confirmar con el cliente.

**Capa pendiente de confirmar**: equipamiento urbano (escuelas, postas, etc.)

### 3.1 Búsqueda predial (próxima tarea)

Ver especificación completa en `PROJECT_STATUS.md` sección 3.1.

Puntos clave:
- `GET /api/predios/buscar?q=&pagina=` usando `buscar_predios()` con FTS + ILIKE
- Parámetro opcional `bbox` (WGS84) para filtrar por extensión visible del mapa
- `BuscadorPredial.jsx` con debounce 300ms y resultado centrado en mapa

### 3.2 Panel censal de Vichuquén — FeatureDialog

Este es el componente diferenciador del producto para el cliente piloto.
Se activa al hacer clic sobre una manzana censal en el mapa.

**Comportamiento**:
- Panel lateral derecho, ancho fijo 380px (no popup flotante)
- El mapa ajusta `padding-right: 380px` para no quedar tapado
- Polígono seleccionado se resalta con borde de color distinto
- Botón X cierra el panel

**Estructura de tabs**:
```
┌─────────────────────────────┐
│ VICHUQUÉN — Aldea           │  ← localidad + categoria (header)
│ Área rural · Región del Maule│
├─────────────────────────────┤
│ [Población] [Educación]     │
│ [Vivienda]  [Servicios]     │
│ [Trabajo]   [Datos técnicos]│
├─────────────────────────────┤
│  Contenido del tab activo   │
│  + Gráficos Recharts        │
└─────────────────────────────┘
```

**Gráficos recomendados por tab**:
- Población: barras Hombres/Mujeres + pirámide etaria simplificada
- Educación: torta distribución CINE (básica/media/superior)
- Vivienda: barra ocupación (ocupadas vs desocupadas)
- Trabajo: barra (ocupados / desocupados / inactivos)

### 3.3 Módulo de reportes ciudadanos

Ver especificación completa en `PROJECT_STATUS.md` sección 3.2.

### 3.4 Integración IDE Chile

Ver especificación completa en `PROJECT_STATUS.md` sección 3.3.

### 3.5 Dashboard analytics

Ver especificación completa en `PROJECT_STATUS.md` sección 3.4.

---

## 11. Modelo de datos censales — Vichuquén

Los atributos del Censo INE 2017 deben agruparse y traducirse en el FeatureDialog.
**Nunca mostrar los nombres de campo crudos al usuario.**

### Grupos y campos principales

#### Identificación geográfica
| Campo | Etiqueta UI |
|-------|------------|
| `localidad` | Localidad |
| `comuna` | Comuna |
| `region` | Región |
| `categoria` | Categoría |
| `area_c` | Área |

#### Población
| Campo | Etiqueta UI |
|-------|------------|
| `n_per` | Total personas |
| `n_hombres` | Hombres |
| `n_mujeres` | Mujeres |
| `prom_edad` | Edad promedio |
| `n_inmigran` | Inmigrantes |
| `n_pueblos_` | Pueblos originarios |
| `n_afrodesc` | Afrodescendientes |

#### Distribución etaria
| Campo | Etiqueta UI |
|-------|------------|
| `n_edad_0_5` | 0–5 años |
| `n_edad_6_1` | 6–13 años |
| `n_edad_14_` | 14–17 años |
| `n_edad_18_` | 18–24 años |
| `n_edad_25_` | 25–44 años |
| `n_edad_45_` | 45–59 años |
| `n_edad_60_` | 60 años o más |

#### Educación
| Campo | Etiqueta UI |
|-------|------------|
| `prom_escol` | Escolaridad promedio (años) |
| `n_analfabe` | Sin leer ni escribir |
| `n_cine_nun` | Sin educación formal |
| `n_cine_pri` | Educación básica |
| `n_cine_sec` | Educación media |
| `n_cine_ter` | Educación superior |

#### Trabajo y empleo
| Campo | Etiqueta UI |
|-------|------------|
| `n_ocupado` | Ocupados |
| `n_desocupa` | Desocupados |
| `n_fuera_fu` | Fuera de la fuerza de trabajo |

#### Vivienda
| Campo | Etiqueta UI |
|-------|------------|
| `n_hog` | Total hogares |
| `prom_per_h` | Personas por hogar |
| `n_vp` | Viviendas particulares |
| `n_vp_ocupa` | Viviendas ocupadas |
| `n_viv_haci` | En hacinamiento |
| `n_deficit_` | Déficit habitacional |
| `n_hog_unip` | Hogares unipersonales |
| `n_hog_60` | Hogares con jefe/a 60+ años |

#### Servicios básicos
| Campo | Etiqueta UI |
|-------|------------|
| `n_serv_tel` | Con telefonía |
| `n_serv_int` | Con internet |
| `n_internet` | Acceso a internet (total) |
| `n_fuente_a` | Agua de red pública |
| `n_serv_hig` | Con alcantarillado |
| `n_fuente_e` | Electricidad de red |
| `n_basura_s` | Basura recolectada |

### Campos en sección "Datos técnicos" (colapsada, sin traducción)
Todos los campos no listados arriba: `n_ciuo_*`, `n_caenes_*`, `n_comb_*`,
`n_mat_*`, `n_transp_*`, `shape_leng`, `shape_area`, `qc_id`, `objectid`,
`manzent`, `cod_*`, `id_*`.

---

## 12. Configuración de Vichuquén como tenant

### Pasos para agregar Vichuquén al sistema existente

1. **Crear schema en PostgreSQL**
```sql
-- Ejecutar como superusuario en el contenedor sig_postgres
-- Usar el script parametrizado existente:
-- database/scripts/crear_municipio.sql con {municipio} = vichuquen
```

2. **Importar capas desde QGIS Cloud**
```bash
# Una vez el cliente exporte SHP/GeoJSON:
ogr2ogr -f "PostgreSQL" \
  PG:"host=localhost port=5432 dbname=sig_municipal user=sig_usuario password=XXX" \
  manzanas_vichuquen.shp \
  -nln mun_vichuquen.manzanas_censales \
  -t_srs EPSG:4326 \
  -overwrite

ogr2ogr -f "PostgreSQL" \
  PG:"host=localhost port=5432 dbname=sig_municipal user=sig_usuario password=XXX" \
  vias_vichuquen.shp \
  -nln mun_vichuquen.vias \
  -t_srs EPSG:4326 \
  -overwrite
```

3. **Crear workspace en GeoServer**
```
POST /geoserver/rest/workspaces  →  { name: "vichuquen" }
POST /geoserver/rest/workspaces/vichuquen/datastores  →  apuntar a sig_postgres, schema mun_vichuquen
Publicar capas manzanas_censales y vias
```

4. **Insertar municipio en tabla pública**
```sql
INSERT INTO public.municipios (nombre, codigo, subdominio, region, plan)
VALUES ('Vichuquén', 'vichuquen', 'vichuquen', 'Maule', 'basico');
```

5. **Agregar host local** (desarrollo Windows)
```
127.0.0.1  vichuquen.localhost
```

### Preguntas pendientes con el cliente Vichuquén

El agente debe registrar estas como bloqueadores si aplican a la tarea actual:

- [ ] ¿En qué CRS/EPSG están las capas en QGIS Cloud? (probablemente EPSG:4326 o EPSG:32718)
- [ ] ¿El cliente puede exportar SHP/GeoJSON desde QGIS Cloud Free?
- [ ] ¿Cuáles son exactamente los atributos de la capa de vías?
- [ ] ¿Hay equipamiento urbano como capa separada?
- [ ] ¿El municipio tiene logo/escudo digital para el topbar?
- [ ] ¿Hay preferencia de proveedor VPS para producción?

---

## 13. Roles y permisos del sistema

| Rol | Acceso |
|-----|--------|
| `superadmin` | Todo el sistema, todos los tenants |
| `admin_municipal` | Panel admin de su municipio |
| `editor_gis` | Gestión de capas de su municipio |
| `funcionario` | Mapa + reportes de su municipio |
| `ciudadano` | Mapa público (sin login) |

---

## 14. Fuera de alcance del MVP — No implementar sin aprobación

- Edición de capas geoespaciales desde el frontend
- Subida de archivos SHP desde la UI
- SSL automático (Fase 4)
- CI/CD pipeline (Fase 4)
- PWA / modo offline
- Multilenguaje / i18n
- Integración con API SII para datos catastrales
- Módulo DOM / permisos de construcción

---

## 15. Fases del proyecto

| Fase | Período | Objetivo | Estado |
|------|---------|----------|--------|
| 1 | Sem. 1–4 | Docker, BD, API base, Frontend base, piloto end-to-end | ✅ |
| 2 | Sem. 5–8 | Panel admin: capas, usuarios, onboarding, log de cambios | ✅ |
| 3 | Sem. 9–16 | Búsqueda predial, reportes ciudadanos, IDE Chile, analytics | 🔜 |
| 4 | Sem. 17+ | SSL automático, monitoreo, backups, CI/CD | 🔜 |

---

## 16. Antes de empezar cualquier tarea

El agente debe responder estas preguntas internamente:

1. ¿Este archivo ya existe en el repo? → Verificar antes de crear.
2. ¿Esta funcionalidad ya está implementada en Fase 1 o 2? → Leer `PROJECT_STATUS.md`.
3. ¿Estoy modificando lógica multi-tenant? → Revisar `middleware/tenant.js` primero.
4. ¿Estoy tocando la BD? → Releer las notas técnicas críticas de la sección 9.
5. ¿Estoy tocando GeoServer? → Recordar host `sig_postgres`, no `localhost`.
6. ¿La tarea requiere datos de Vichuquén que aún no están disponibles? → Marcar como bloqueador, no inventar datos.
