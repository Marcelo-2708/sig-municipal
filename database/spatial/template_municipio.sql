-- =============================================================================
-- TEMPLATE: Esquema espacial por municipio
-- Proyecto: SIG Municipal — Plataforma WebGIS Multi-tenant
-- Descripción: Estructura de tablas geoespaciales para cada municipio.
--              Se ejecuta UNA VEZ por municipio durante el proceso de onboarding.
-- PostgreSQL 15 + PostGIS 3.4
-- Fecha: 2026-05-01
-- =============================================================================
--
-- USO:
--   Este archivo usa {municipio} como placeholder.
--   El script crear_municipio.sql (o el proceso de onboarding) reemplaza
--   {municipio} por el código real antes de ejecutar.
--
--   Ejemplo de reemplazo en bash:
--     sed 's/{municipio}/mun_concepcion/g' template_municipio.sql | psql ...
--
--   El placeholder {municipio} corresponde al esquema_bd del municipio
--   (formato: mun_<codigo>, ej: mun_concepcion, mun_demo)
-- =============================================================================

-- El schema debe crearse ANTES de ejecutar este template (ver crear_municipio.sql)
-- SET search_path = {municipio}, public;

-- =============================================================================
-- TABLA: predios
-- Catastro predial — polígonos de cada predio con atributos del SII
-- =============================================================================
CREATE TABLE IF NOT EXISTS {municipio}.predios (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_sii                 VARCHAR(20) NOT NULL,       -- Rol único SII: ej. 123-456
    direccion               TEXT        NOT NULL,
    propietario             TEXT,
    rut_propietario         VARCHAR(12),               -- RUT con dígito verificador: 12.345.678-9
    uso_suelo               VARCHAR(100),
    superficie_m2           NUMERIC(12, 2),
    tasacion_fiscal         NUMERIC(14, 2),
    anio_construccion       SMALLINT,
    numero_pisos            SMALLINT    CHECK (numero_pisos > 0),
    geometria               GEOMETRY(Polygon, 4326) NOT NULL,   -- polígono en WGS84
    fuente                  VARCHAR(200),
    fecha_actualizacion     DATE,
    activo                  BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT predios_rol_uq       UNIQUE (rol_sii),
    CONSTRAINT predios_superficie   CHECK (superficie_m2 IS NULL OR superficie_m2 > 0),
    CONSTRAINT predios_tasacion     CHECK (tasacion_fiscal IS NULL OR tasacion_fiscal >= 0),
    CONSTRAINT predios_anio         CHECK (anio_construccion IS NULL OR (anio_construccion > 1800 AND anio_construccion <= EXTRACT(YEAR FROM NOW())::SMALLINT + 1))
);

COMMENT ON TABLE  {municipio}.predios           IS 'Catastro predial municipal — un polígono por predio';
COMMENT ON COLUMN {municipio}.predios.rol_sii   IS 'Identificador único del Servicio de Impuestos Internos (SII)';
COMMENT ON COLUMN {municipio}.predios.geometria IS 'Polígono del predio en EPSG:4326 (WGS84)';

-- Índice GIST en geometría (búsquedas espaciales)
CREATE INDEX IF NOT EXISTS idx_{municipio}_predios_geom
    ON {municipio}.predios USING GIST (geometria);

-- Índice GIN full-text en dirección
-- to_tsvector('spanish', col) es IMMUTABLE con configuración literal.
-- unaccent() es STABLE y no puede usarse en expresiones de índice directamente.
CREATE INDEX IF NOT EXISTS idx_{municipio}_predios_fts
    ON {municipio}.predios USING GIN (to_tsvector('spanish', direccion));

-- Índice de expresión en dirección normalizada para búsquedas ILIKE
-- unaccent() es STABLE, no IMMUTABLE → no puede usarse en columna GENERATED;
-- un índice de expresión logra el mismo rendimiento sin ese requisito.
CREATE INDEX IF NOT EXISTS idx_{municipio}_predios_dir_norm
    ON {municipio}.predios ((lower(unaccent(direccion))));

-- Índice en rol_sii para búsquedas exactas
CREATE INDEX IF NOT EXISTS idx_{municipio}_predios_rol
    ON {municipio}.predios (rol_sii);

-- Índice en activo para filtrar predios activos
CREATE INDEX IF NOT EXISTS idx_{municipio}_predios_activo
    ON {municipio}.predios (activo) WHERE activo = TRUE;

-- Trigger de timestamp
CREATE OR REPLACE TRIGGER tg_{municipio}_predios_actualizado
    BEFORE UPDATE ON {municipio}.predios
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();


-- =============================================================================
-- TABLA: permisos_edificacion
-- Permisos de edificación otorgados por la Dirección de Obras Municipal (DOM)
-- =============================================================================
CREATE TABLE IF NOT EXISTS {municipio}.permisos_edificacion (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_permiso      VARCHAR(50) NOT NULL,           -- número de expediente DOM
    predio_id           UUID        REFERENCES {municipio}.predios(id) ON DELETE SET NULL,
    tipo_obra           VARCHAR(100) NOT NULL
                        CHECK (tipo_obra IN (
                            'construccion_nueva', 'ampliacion', 'remodelacion',
                            'demolicion', 'regularizacion', 'obra_menor', 'otro'
                        )),
    estado              VARCHAR(50) NOT NULL DEFAULT 'en_tramite'
                        CHECK (estado IN (
                            'en_tramite', 'aprobado', 'rechazado',
                            'en_ejecucion', 'finalizado', 'caducado'
                        )),
    solicitante         TEXT        NOT NULL,
    rut_solicitante     VARCHAR(12),
    arquitecto          TEXT,
    superficie_m2       NUMERIC(12, 2),
    fecha_solicitud     DATE        NOT NULL,
    fecha_aprobacion    DATE,
    fecha_vencimiento   DATE,
    observaciones       TEXT,
    ubicacion           GEOMETRY(Point, 4326),          -- punto de referencia del permiso
    direccion           TEXT,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT permisos_numero_uq   UNIQUE (numero_permiso),
    CONSTRAINT permisos_fechas      CHECK (
        fecha_aprobacion IS NULL OR fecha_aprobacion >= fecha_solicitud
    ),
    CONSTRAINT permisos_vencimiento CHECK (
        fecha_vencimiento IS NULL OR fecha_aprobacion IS NULL
        OR fecha_vencimiento > fecha_aprobacion
    )
);

COMMENT ON TABLE  {municipio}.permisos_edificacion           IS 'Permisos de edificación otorgados por la Dirección de Obras Municipal';
COMMENT ON COLUMN {municipio}.permisos_edificacion.numero_permiso IS 'Número de expediente DOM — identificador oficial';
COMMENT ON COLUMN {municipio}.permisos_edificacion.ubicacion  IS 'Punto de referencia del permiso en EPSG:4326 (WGS84)';

-- Índice GIST en geometría
CREATE INDEX IF NOT EXISTS idx_{municipio}_permisos_geom
    ON {municipio}.permisos_edificacion USING GIST (ubicacion)
    WHERE ubicacion IS NOT NULL;

-- Índices B-tree
CREATE INDEX IF NOT EXISTS idx_{municipio}_permisos_estado
    ON {municipio}.permisos_edificacion (estado);

CREATE INDEX IF NOT EXISTS idx_{municipio}_permisos_predio
    ON {municipio}.permisos_edificacion (predio_id)
    WHERE predio_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_{municipio}_permisos_fecha
    ON {municipio}.permisos_edificacion (fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_{municipio}_permisos_numero
    ON {municipio}.permisos_edificacion (numero_permiso);

-- Trigger de timestamp
CREATE OR REPLACE TRIGGER tg_{municipio}_permisos_actualizado
    BEFORE UPDATE ON {municipio}.permisos_edificacion
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();


-- =============================================================================
-- TABLA: plano_regulador
-- Zonificación del Plan Regulador Comunal (PRC)
-- Polígonos de zonas con atributos de uso de suelo y normativa
-- =============================================================================
CREATE TABLE IF NOT EXISTS {municipio}.plano_regulador (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_zona             VARCHAR(20) NOT NULL,       -- ej: ZR1, ZC2, ZI, ZPNE
    nombre_zona             VARCHAR(200) NOT NULL,
    uso_permitido           TEXT,                       -- descripción del uso de suelo permitido
    uso_prohibido           TEXT,
    coeficiente_ocupacion   NUMERIC(5,2),               -- porcentaje de ocupación de suelo (0-100)
    coeficiente_constructividad NUMERIC(6,2),           -- índice de constructividad
    altura_maxima_m         NUMERIC(6,1),               -- altura máxima en metros
    distanciamiento_m       NUMERIC(6,2),               -- distanciamiento mínimo del predio
    superficie_min_m2       NUMERIC(10,2),              -- superficie mínima del predio
    observaciones           TEXT,
    vigente                 BOOLEAN     NOT NULL DEFAULT TRUE,
    fecha_vigencia          DATE,
    ordenanza_ref           VARCHAR(200),               -- referencia a ordenanza municipal
    geometria               GEOMETRY(MultiPolygon, 4326) NOT NULL, -- zona en WGS84
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT plano_codigo_uq          UNIQUE (codigo_zona),
    CONSTRAINT plano_ocupacion_rango    CHECK (coeficiente_ocupacion IS NULL OR (coeficiente_ocupacion >= 0 AND coeficiente_ocupacion <= 100)),
    CONSTRAINT plano_constructividad    CHECK (coeficiente_constructividad IS NULL OR coeficiente_constructividad >= 0),
    CONSTRAINT plano_altura_positiva    CHECK (altura_maxima_m IS NULL OR altura_maxima_m > 0)
);

COMMENT ON TABLE  {municipio}.plano_regulador             IS 'Zonificación del Plan Regulador Comunal (PRC) — un polígono por zona';
COMMENT ON COLUMN {municipio}.plano_regulador.codigo_zona IS 'Código de zona según PRC (ej: ZR1=Residencial 1, ZC=Comercial)';
COMMENT ON COLUMN {municipio}.plano_regulador.geometria   IS 'Polígono(s) de la zona en EPSG:4326 (WGS84)';

-- Índice GIST en geometría (fundamental para función zona_en_punto)
CREATE INDEX IF NOT EXISTS idx_{municipio}_plano_geom
    ON {municipio}.plano_regulador USING GIST (geometria);

-- Índices B-tree
CREATE INDEX IF NOT EXISTS idx_{municipio}_plano_codigo
    ON {municipio}.plano_regulador (codigo_zona);

CREATE INDEX IF NOT EXISTS idx_{municipio}_plano_vigente
    ON {municipio}.plano_regulador (vigente) WHERE vigente = TRUE;

-- Trigger de timestamp
CREATE OR REPLACE TRIGGER tg_{municipio}_plano_actualizado
    BEFORE UPDATE ON {municipio}.plano_regulador
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();


-- =============================================================================
-- TABLA: alumbrado
-- Puntos de luminaria del alumbrado público municipal
-- =============================================================================
CREATE TABLE IF NOT EXISTS {municipio}.alumbrado (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_luminaria    VARCHAR(50),                    -- código interno municipal
    tipo_luminaria      VARCHAR(100)
                        CHECK (tipo_luminaria IN (
                            'led', 'sodio', 'mercurio', 'halogenuros', 'fluorescente', 'otro'
                        )),
    potencia_w          SMALLINT    CHECK (potencia_w > 0),
    estado              VARCHAR(50) NOT NULL DEFAULT 'operativo'
                        CHECK (estado IN ('operativo', 'averiado', 'en_mantenimiento', 'retirado')),
    altura_poste_m      NUMERIC(5,1) CHECK (altura_poste_m > 0),
    fecha_instalacion   DATE,
    fecha_ultimo_mant   DATE,
    empresa_contrato    TEXT,
    numero_contrato     VARCHAR(100),
    observaciones       TEXT,
    geometria           GEOMETRY(Point, 4326) NOT NULL, -- punto de la luminaria en WGS84
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT alumbrado_codigo_uq UNIQUE (codigo_luminaria)
);

COMMENT ON TABLE  {municipio}.alumbrado             IS 'Puntos de luminaria del alumbrado público municipal';
COMMENT ON COLUMN {municipio}.alumbrado.geometria   IS 'Ubicación de la luminaria en EPSG:4326 (WGS84)';
COMMENT ON COLUMN {municipio}.alumbrado.potencia_w  IS 'Potencia en Watts de la luminaria';

-- Índice GIST en geometría
CREATE INDEX IF NOT EXISTS idx_{municipio}_alumbrado_geom
    ON {municipio}.alumbrado USING GIST (geometria);

-- Índices B-tree
CREATE INDEX IF NOT EXISTS idx_{municipio}_alumbrado_estado
    ON {municipio}.alumbrado (estado);

CREATE INDEX IF NOT EXISTS idx_{municipio}_alumbrado_codigo
    ON {municipio}.alumbrado (codigo_luminaria)
    WHERE codigo_luminaria IS NOT NULL;

-- Trigger de timestamp
CREATE OR REPLACE TRIGGER tg_{municipio}_alumbrado_actualizado
    BEFORE UPDATE ON {municipio}.alumbrado
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();
