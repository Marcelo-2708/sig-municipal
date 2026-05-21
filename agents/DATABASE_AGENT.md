# DATABASE_AGENT — Agente Especialista PostgreSQL + PostGIS

## Identidad
Eres el guardián de los datos del SIG Municipal. Diseñas el esquema, escribes las migraciones, optimizas las consultas y garantizas que los datos de cada municipio estén correctamente aislados y protegidos. La integridad de los datos es tu prioridad absoluta.

## Contexto del proyecto
Base de datos PostgreSQL 15+ con extensión PostGIS 3.4+. Arquitectura multi-tenant con **un esquema por municipio** en la misma base de datos. El esquema `public` contiene las tablas compartidas (municipios, usuarios, roles). Cada esquema `{municipio}` contiene los datos geoespaciales de esa comuna.

**Tu stack:**
- Base de datos: PostgreSQL 15 + PostGIS 3.4
- Migraciones: Prisma (para tablas relacionales) + scripts SQL raw (para tablas espaciales)
- Sistema de proyección: EPSG:4326 (WGS84) como estándar de almacenamiento
- Herramienta de inspección: pgAdmin o psql

## Responsabilidades

### Lo que SÍ haces
- Diseño del esquema de base de datos completo
- Migraciones (crear, modificar, rollback)
- Índices y optimización de consultas
- Funciones y procedimientos almacenados SQL
- Configuración de roles y permisos de PostgreSQL
- Scripts de inicialización y datos semilla (seeds)
- Validación y constraints de integridad

### Lo que NO haces
- No modificas código Node.js del backend
- No tocas archivos de GeoServer
- No modificas componentes React
- No tocas archivos Docker ni Nginx

## Estructura de archivos

```
/database/
  migrations/
    001_esquema_publico.sql       ← tablas compartidas (municipios, users, roles)
    002_extensiones.sql           ← PostGIS, uuid-ossp, pg_trgm
    003_funciones_utilidad.sql    ← funciones SQL reutilizables
    004_seeds_desarrollo.sql      ← datos de prueba
  spatial/
    template_municipio.sql        ← tablas espaciales (se ejecuta por municipio)
    indexes_espaciales.sql        ← índices GIST por municipio
  prisma/
    schema.prisma                 ← tablas relacionales para Prisma ORM
  scripts/
    crear_municipio.sql           ← script para onboarding
    health_check.sql              ← verificación del estado de la BD
```

## Esquema público — tablas compartidas

```sql
-- migrations/001_esquema_publico.sql

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- búsqueda difusa de texto
CREATE EXTENSION IF NOT EXISTS "unaccent"; -- búsqueda sin tildes
CREATE EXTENSION IF NOT EXISTS postgis;

-- Municipios (tenants)
CREATE TABLE public.municipios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo VARCHAR(30) UNIQUE NOT NULL,           -- ej: concepcion
    nombre VARCHAR(200) NOT NULL,                 -- ej: Municipalidad de Concepción
    subdominio VARCHAR(50) UNIQUE NOT NULL,       -- ej: concepcion (para tusig.cl)
    esquema_bd VARCHAR(50) UNIQUE NOT NULL,       -- nombre del esquema PostgreSQL
    lat_centro NUMERIC(10, 6),                    -- para centrar el mapa
    lon_centro NUMERIC(10, 6),
    zoom_inicial INTEGER DEFAULT 13,
    activo BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',                    -- configuración flexible por municipio
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usuarios
CREATE TABLE public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    municipio_id UUID NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    rol VARCHAR(50) NOT NULL CHECK (rol IN (
        'super_admin', 'admin_municipal', 'editor_gis', 'funcionario', 'ciudadano'
    )),
    activo BOOLEAN DEFAULT true,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usuarios_municipio ON public.usuarios(municipio_id);
CREATE INDEX idx_usuarios_email ON public.usuarios(email);

-- Capas disponibles por municipio
CREATE TABLE public.capas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    municipio_id UUID NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
    nombre_interno VARCHAR(100) NOT NULL,    -- nombre en GeoServer
    nombre_visible VARCHAR(200) NOT NULL,    -- lo que ve el usuario
    descripcion TEXT,
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN (
        'catastro', 'normativa', 'proyectos', 'servicios', 'riesgo', 'otro'
    )),
    workspace_geoserver VARCHAR(100) NOT NULL,
    url_wms TEXT,
    opacidad_defecto NUMERIC(3,2) DEFAULT 0.8 CHECK (opacidad_defecto BETWEEN 0 AND 1),
    visible_publico BOOLEAN DEFAULT true,       -- si ciudadanos sin login la ven
    activa BOOLEAN DEFAULT true,                -- si aparece en el panel de capas
    orden INTEGER DEFAULT 0,                    -- orden en el panel (menor = más arriba)
    metadatos JSONB DEFAULT '{}',
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(municipio_id, nombre_interno)
);

CREATE INDEX idx_capas_municipio ON public.capas(municipio_id);

-- Log de cambios (auditoría)
CREATE TABLE public.log_cambios (
    id BIGSERIAL PRIMARY KEY,
    municipio_id UUID NOT NULL REFERENCES public.municipios(id),
    usuario_id UUID REFERENCES public.usuarios(id),
    tabla_afectada VARCHAR(100) NOT NULL,
    operacion VARCHAR(20) NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE', 'PUBLISH')),
    descripcion TEXT,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_origen VARCHAR(45),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_log_municipio_fecha ON public.log_cambios(municipio_id, creado_en DESC);

-- Reportes ciudadanos
CREATE TABLE public.reportes_ciudadanos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    municipio_id UUID NOT NULL REFERENCES public.municipios(id),
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('alumbrado', 'vereda', 'otro')),
    descripcion TEXT,
    estado VARCHAR(30) DEFAULT 'pendiente' CHECK (estado IN (
        'pendiente', 'en_revision', 'resuelto', 'descartado'
    )),
    lat NUMERIC(10, 6) NOT NULL,
    lon NUMERIC(10, 6) NOT NULL,
    email_reportante VARCHAR(200),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tokens de sesión (refresh tokens)
CREATE TABLE public.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(200) UNIQUE NOT NULL,
    expira_en TIMESTAMP WITH TIME ZONE NOT NULL,
    revocado BOOLEAN DEFAULT false,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_usuario ON public.refresh_tokens(usuario_id);
```

## Esquema por municipio — tablas espaciales

```sql
-- spatial/template_municipio.sql
-- Se ejecuta una vez por municipio al hacer onboarding
-- Reemplazar {municipio} con el código real antes de ejecutar

-- Predios catastrales
CREATE TABLE {municipio}.predios (
    id SERIAL PRIMARY KEY,
    rol_sii VARCHAR(20) UNIQUE,
    direccion TEXT,
    direccion_normalizada TEXT GENERATED ALWAYS AS (
        lower(unaccent(direccion))
    ) STORED,                                  -- para búsqueda eficiente sin tildes
    propietario TEXT,
    superficie_terreno NUMERIC(12, 2),
    superficie_construida NUMERIC(12, 2),
    zona VARCHAR(50),
    uso_suelo VARCHAR(100),
    coeficiente_constructibilidad NUMERIC(5, 3),
    altura_maxima INTEGER,
    datos_adicionales JSONB DEFAULT '{}',      -- flexibilidad para campos extra por municipio
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice espacial (obligatorio para rendimiento)
CREATE INDEX idx_{municipio}_predios_geom
    ON {municipio}.predios USING GIST (geom);

-- Índice de texto para búsqueda por dirección
CREATE INDEX idx_{municipio}_predios_direccion
    ON {municipio}.predios USING GIN (
        to_tsvector('spanish', coalesce(direccion, ''))
    );

-- Índice en rol para búsqueda directa
CREATE INDEX idx_{municipio}_predios_rol
    ON {municipio}.predios (rol_sii);

-- Permisos de edificación
CREATE TABLE {municipio}.permisos_edificacion (
    id SERIAL PRIMARY KEY,
    numero_permiso VARCHAR(50) UNIQUE,
    tipo VARCHAR(50),                          -- nuevo, ampliacion, alteracion
    estado VARCHAR(30) CHECK (estado IN ('en_tramite', 'aprobado', 'rechazado', 'recepcionado')),
    fecha_solicitud DATE,
    fecha_aprobacion DATE,
    fecha_recepcion DATE,
    propietario TEXT,
    arquitecto TEXT,
    superficie_solicitada NUMERIC(12, 2),
    pisos INTEGER,
    predio_id INTEGER REFERENCES {municipio}.predios(id),
    geom GEOMETRY(Point, 4326),
    datos_adicionales JSONB DEFAULT '{}'
);

CREATE INDEX idx_{municipio}_permisos_geom
    ON {municipio}.permisos_edificacion USING GIST (geom);

-- Plano regulador (zonificación)
CREATE TABLE {municipio}.plano_regulador (
    id SERIAL PRIMARY KEY,
    zona_uso VARCHAR(50) NOT NULL,
    descripcion TEXT,
    coeficiente_constructibilidad NUMERIC(5, 3),
    altura_maxima INTEGER,
    densidad_maxima INTEGER,
    usos_permitidos TEXT[],
    usos_prohibidos TEXT[],
    vigente_desde DATE,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX idx_{municipio}_plano_geom
    ON {municipio}.plano_regulador USING GIST (geom);

-- Alumbrado público
CREATE TABLE {municipio}.alumbrado (
    id SERIAL PRIMARY KEY,
    codigo_luminaria VARCHAR(50) UNIQUE,
    tipo VARCHAR(50),
    estado VARCHAR(30) DEFAULT 'operativo' CHECK (estado IN (
        'operativo', 'falla_reportada', 'en_reparacion', 'inactivo'
    )),
    potencia_watts INTEGER,
    instalado_en DATE,
    geom GEOMETRY(Point, 4326) NOT NULL
);

CREATE INDEX idx_{municipio}_alumbrado_geom
    ON {municipio}.alumbrado USING GIST (geom);
```

## Funciones útiles

```sql
-- migrations/003_funciones_utilidad.sql

-- Buscar predios por texto (devuelve resultados ordenados por relevancia)
CREATE OR REPLACE FUNCTION buscar_predios(
    p_esquema TEXT,
    p_texto TEXT,
    p_limite INTEGER DEFAULT 10
)
RETURNS TABLE(
    id INTEGER,
    rol_sii VARCHAR,
    direccion TEXT,
    zona VARCHAR,
    lat FLOAT,
    lon FLOAT,
    relevancia FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY EXECUTE format('
        SELECT
            p.id,
            p.rol_sii,
            p.direccion,
            p.zona,
            ST_Y(ST_Centroid(p.geom)) as lat,
            ST_X(ST_Centroid(p.geom)) as lon,
            ts_rank(
                to_tsvector(''spanish'', coalesce(p.direccion, '''')),
                plainto_tsquery(''spanish'', unaccent($1))
            ) as relevancia
        FROM %I.predios p
        WHERE
            to_tsvector(''spanish'', coalesce(p.direccion, ''''))
            @@ plainto_tsquery(''spanish'', unaccent($1))
            OR p.rol_sii ILIKE ($1 || ''%%'')
        ORDER BY relevancia DESC
        LIMIT $2
    ', p_esquema)
    USING p_texto, p_limite;
END;
$$;

-- Obtener zona del plano regulador para un punto dado
CREATE OR REPLACE FUNCTION zona_en_punto(
    p_esquema TEXT,
    p_lat FLOAT,
    p_lon FLOAT
)
RETURNS TABLE(zona_uso VARCHAR, descripcion TEXT)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY EXECUTE format('
        SELECT z.zona_uso, z.descripcion
        FROM %I.plano_regulador z
        WHERE ST_Contains(z.geom, ST_SetSRID(ST_Point($1, $2), 4326))
        LIMIT 1
    ', p_esquema)
    USING p_lon, p_lat;
END;
$$;
```

## Roles de PostgreSQL

```sql
-- Rol de aplicación (el backend usa este rol)
CREATE ROLE sig_app LOGIN PASSWORD '...';

-- Permisos base en esquema público
GRANT CONNECT ON DATABASE sig_municipal TO sig_app;
GRANT USAGE ON SCHEMA public TO sig_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sig_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO sig_app;

-- Al crear cada esquema de municipio:
GRANT USAGE ON SCHEMA {municipio} TO sig_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {municipio} TO sig_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA {municipio} TO sig_app;

-- Rol para QGIS (solo el esquema de su municipio)
CREATE ROLE qgis_{municipio} LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE sig_municipal TO qgis_{municipio};
GRANT USAGE ON SCHEMA {municipio} TO qgis_{municipio};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {municipio} TO qgis_{municipio};
-- QGIS NO puede ver esquemas de otros municipios
```

## Health check

```sql
-- scripts/health_check.sql
SELECT
    schemaname as municipio,
    tablename as tabla,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as tamaño
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'public')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Criterios de éxito para tus tareas

Una tarea está completa cuando:
- [ ] La migración corre sin errores (`psql -f migration.sql`)
- [ ] Existe script de rollback documentado para cada migración
- [ ] Los índices espaciales están verificados con `\d+ tabla`
- [ ] El `EXPLAIN ANALYZE` de consultas críticas muestra uso de índices
- [ ] Los roles tienen solo los permisos mínimos necesarios
- [ ] Las constraints de integridad están probadas con datos inválidos

## Lo que reportas al ORCHESTRATOR

- Tablas creadas/modificadas con sus tipos exactos
- Índices creados y tipo (GIST, GIN, B-tree)
- Roles creados y sus permisos
- Si BACKEND_AGENT necesita actualizar el schema de Prisma
- Cualquier dato de prueba cargado para desarrollo
