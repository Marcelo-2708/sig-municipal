-- =============================================================================
-- init_mun_demo.sql
-- Crea el esquema mun_demo y sus tablas espaciales para el piloto de desarrollo.
--
-- Uso:
--   docker exec -i sig_postgres psql -U sig_usuario -d sig_municipal -f /ruta/init_mun_demo.sql
--
--   O desde la raiz del proyecto (PowerShell):
--   Get-Content database\scripts\init_mun_demo.sql | docker exec -i sig_postgres psql -U sig_usuario -d sig_municipal
--
-- Requisitos previos (deben haberse ejecutado antes):
--   - 002_extensiones.sql  (PostGIS, unaccent, configuracion FTS spanish_unaccent)
--   - 001_esquema_publico.sql  (rol sig_app, tabla public.municipios)
--   - 003_funciones_utilidad.sql  (fn_actualizar_timestamp)
--   - 004_seeds_desarrollo.sql  (registro del municipio demo en public.municipios)
--
-- El script es idempotente: puede ejecutarse multiples veces sin error.
-- =============================================================================

\set ON_ERROR_STOP on

\echo '>>> Iniciando creacion del esquema mun_demo...'

-- =============================================================================
-- ESQUEMA
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS mun_demo;
COMMENT ON SCHEMA mun_demo IS 'Esquema de datos espaciales — Municipio Demo (piloto de desarrollo)';

-- =============================================================================
-- TABLA: predios
-- Catastro predial. Geometria Polygon en WGS84 (EPSG:4326).
-- Estructura identica al template_municipio.sql con {municipio}=mun_demo.
-- =============================================================================
CREATE TABLE IF NOT EXISTS mun_demo.predios (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_sii               VARCHAR(20)  NOT NULL,
    direccion             TEXT         NOT NULL,
    propietario           TEXT,
    rut_propietario       VARCHAR(12),
    uso_suelo             VARCHAR(100),
    superficie_m2         NUMERIC(12, 2),
    tasacion_fiscal       NUMERIC(14, 2),
    anio_construccion     SMALLINT,
    numero_pisos          SMALLINT     CHECK (numero_pisos > 0),
    geometria             GEOMETRY(Polygon, 4326) NOT NULL,
    fuente                VARCHAR(200),
    fecha_actualizacion   DATE,
    activo                BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT predios_rol_uq     UNIQUE (rol_sii),
    CONSTRAINT predios_superficie CHECK (superficie_m2 IS NULL OR superficie_m2 > 0),
    CONSTRAINT predios_tasacion   CHECK (tasacion_fiscal IS NULL OR tasacion_fiscal >= 0),
    CONSTRAINT predios_anio       CHECK (
        anio_construccion IS NULL OR
        (anio_construccion > 1800 AND anio_construccion <= EXTRACT(YEAR FROM NOW())::SMALLINT + 1)
    )
);

COMMENT ON TABLE  mun_demo.predios     IS 'Catastro predial municipal — un poligono por predio';
COMMENT ON COLUMN mun_demo.predios.rol_sii   IS 'Identificador unico del Servicio de Impuestos Internos (SII)';
COMMENT ON COLUMN mun_demo.predios.geometria IS 'Poligono del predio en EPSG:4326 (WGS84)';

-- =============================================================================
-- INDICES
-- =============================================================================

-- Busquedas espaciales (obligatorio para GeoServer WMS)
CREATE INDEX IF NOT EXISTS idx_mun_demo_predios_geom
    ON mun_demo.predios USING GIST (geometria);

-- Full-text search en direccion
-- to_tsvector('spanish', col) es IMMUTABLE cuando recibe literales de configuracion.
-- unaccent() es STABLE y no puede usarse en expresiones de indice.
CREATE INDEX IF NOT EXISTS idx_mun_demo_predios_fts
    ON mun_demo.predios USING GIN (to_tsvector('spanish', direccion));

-- Busquedas ILIKE por direccion normalizada (indice de expresion — evita columna generada)
CREATE INDEX IF NOT EXISTS idx_mun_demo_predios_dir_norm
    ON mun_demo.predios ((lower(direccion)));

-- Busquedas exactas por rol SII
CREATE INDEX IF NOT EXISTS idx_mun_demo_predios_rol
    ON mun_demo.predios (rol_sii);

-- Filtro rapido de predios activos
CREATE INDEX IF NOT EXISTS idx_mun_demo_predios_activo
    ON mun_demo.predios (activo) WHERE activo = TRUE;

-- =============================================================================
-- TRIGGER: actualizar columna actualizado_en automaticamente
-- =============================================================================
CREATE OR REPLACE TRIGGER tg_mun_demo_predios_actualizado
    BEFORE UPDATE ON mun_demo.predios
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();

-- =============================================================================
-- PERMISOS: rol sig_app (usuario de aplicacion — permisos minimos)
-- =============================================================================
GRANT USAGE                            ON SCHEMA mun_demo        TO sig_app;
GRANT SELECT, INSERT, UPDATE, DELETE   ON ALL TABLES IN SCHEMA mun_demo TO sig_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA mun_demo
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sig_app;

-- =============================================================================
-- DATOS DE MUESTRA
-- Tres predios con geometrias reales cerca del centro de Concepcion, Chile.
-- Necesarios para que GeoServer pueda calcular el bounding box de la capa
-- y renderizar una vista de prueba en GetMap.
-- Coordenadas aproximadas: area del centro de Concepcion (~-36.82, -73.05)
-- =============================================================================
INSERT INTO mun_demo.predios (
    rol_sii, direccion, propietario, uso_suelo,
    superficie_m2, numero_pisos, geometria
)
VALUES
(
    '123-001',
    'Avenida OHiggins 123, Concepcion',
    'Municipalidad de Concepcion',
    'comercial',
    520.00,
    4,
    ST_GeomFromText(
        'POLYGON((-73.0510 -36.8270,
                  -73.0500 -36.8270,
                  -73.0500 -36.8280,
                  -73.0510 -36.8280,
                  -73.0510 -36.8270))',
        4326
    )
),
(
    '123-002',
    'Calle Barros Arana 456, Concepcion',
    'Comercial del Sur S.A.',
    'residencial',
    380.00,
    2,
    ST_GeomFromText(
        'POLYGON((-73.0520 -36.8260,
                  -73.0510 -36.8260,
                  -73.0510 -36.8270,
                  -73.0520 -36.8270,
                  -73.0520 -36.8260))',
        4326
    )
),
(
    '123-003',
    'Calle Caupolican 789, Concepcion',
    'Inversiones Biobio Ltda.',
    'industrial',
    950.00,
    1,
    ST_GeomFromText(
        'POLYGON((-73.0530 -36.8280,
                  -73.0515 -36.8280,
                  -73.0515 -36.8295,
                  -73.0530 -36.8295,
                  -73.0530 -36.8280))',
        4326
    )
)
ON CONFLICT (rol_sii) DO NOTHING;

-- =============================================================================
-- VERIFICACION FINAL
-- =============================================================================
\echo ''
\echo '>>> Verificando resultado...'

SELECT
    schemaname        AS esquema,
    tablename         AS tabla,
    tableowner        AS propietario
FROM pg_tables
WHERE schemaname = 'mun_demo'
ORDER BY tablename;

SELECT
    indexname         AS indice,
    indexdef
FROM pg_indexes
WHERE schemaname = 'mun_demo'
ORDER BY indexname;

SELECT
    COUNT(*)          AS total_predios,
    ST_Extent(geometria)::TEXT AS bbox
FROM mun_demo.predios;

\echo ''
\echo '>>> mun_demo listo. GeoServer puede conectarse al datastore demo_postgis.'
\echo '>>> Ejecutar configurar_demo.ps1 para publicar la capa en GeoServer.'
