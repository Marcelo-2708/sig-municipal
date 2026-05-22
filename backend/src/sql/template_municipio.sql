-- Template de tablas espaciales por municipio.
-- El servicio de onboarding reemplaza {municipio} por el esquema real (ej: mun_concepcion)
-- antes de ejecutar este script. No modificar el placeholder.

CREATE TABLE IF NOT EXISTS {municipio}.predios (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    rol_sii                 VARCHAR(20) NOT NULL,
    direccion               TEXT        NOT NULL,
    propietario             TEXT,
    rut_propietario         VARCHAR(12),
    uso_suelo               VARCHAR(100),
    superficie_m2           NUMERIC(12, 2),
    tasacion_fiscal         NUMERIC(14, 2),
    anio_construccion       SMALLINT,
    numero_pisos            SMALLINT    CHECK (numero_pisos > 0),
    geometria               GEOMETRY(Polygon, 4326) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_{municipio}_predios_geom
    ON {municipio}.predios USING GIST (geometria);

CREATE INDEX IF NOT EXISTS idx_{municipio}_predios_fts
    ON {municipio}.predios USING GIN (to_tsvector('spanish', direccion));

CREATE INDEX IF NOT EXISTS idx_{municipio}_predios_dir_norm
    ON {municipio}.predios ((lower(unaccent(direccion))));

CREATE INDEX IF NOT EXISTS idx_{municipio}_predios_rol
    ON {municipio}.predios (rol_sii);

CREATE INDEX IF NOT EXISTS idx_{municipio}_predios_activo
    ON {municipio}.predios (activo) WHERE activo = TRUE;

CREATE OR REPLACE TRIGGER tg_{municipio}_predios_actualizado
    BEFORE UPDATE ON {municipio}.predios
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();


CREATE TABLE IF NOT EXISTS {municipio}.permisos_edificacion (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_permiso      VARCHAR(50) NOT NULL,
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
    ubicacion           GEOMETRY(Point, 4326),
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

CREATE INDEX IF NOT EXISTS idx_{municipio}_permisos_geom
    ON {municipio}.permisos_edificacion USING GIST (ubicacion)
    WHERE ubicacion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_{municipio}_permisos_estado
    ON {municipio}.permisos_edificacion (estado);

CREATE INDEX IF NOT EXISTS idx_{municipio}_permisos_predio
    ON {municipio}.permisos_edificacion (predio_id)
    WHERE predio_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_{municipio}_permisos_fecha
    ON {municipio}.permisos_edificacion (fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_{municipio}_permisos_numero
    ON {municipio}.permisos_edificacion (numero_permiso);

CREATE OR REPLACE TRIGGER tg_{municipio}_permisos_actualizado
    BEFORE UPDATE ON {municipio}.permisos_edificacion
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();


CREATE TABLE IF NOT EXISTS {municipio}.plano_regulador (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_zona             VARCHAR(20) NOT NULL,
    nombre_zona             VARCHAR(200) NOT NULL,
    uso_permitido           TEXT,
    uso_prohibido           TEXT,
    coeficiente_ocupacion   NUMERIC(5,2),
    coeficiente_constructividad NUMERIC(6,2),
    altura_maxima_m         NUMERIC(6,1),
    distanciamiento_m       NUMERIC(6,2),
    superficie_min_m2       NUMERIC(10,2),
    observaciones           TEXT,
    vigente                 BOOLEAN     NOT NULL DEFAULT TRUE,
    fecha_vigencia          DATE,
    ordenanza_ref           VARCHAR(200),
    geometria               GEOMETRY(MultiPolygon, 4326) NOT NULL,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT plano_codigo_uq          UNIQUE (codigo_zona),
    CONSTRAINT plano_ocupacion_rango    CHECK (coeficiente_ocupacion IS NULL OR (coeficiente_ocupacion >= 0 AND coeficiente_ocupacion <= 100)),
    CONSTRAINT plano_constructividad    CHECK (coeficiente_constructividad IS NULL OR coeficiente_constructividad >= 0),
    CONSTRAINT plano_altura_positiva    CHECK (altura_maxima_m IS NULL OR altura_maxima_m > 0)
);

CREATE INDEX IF NOT EXISTS idx_{municipio}_plano_geom
    ON {municipio}.plano_regulador USING GIST (geometria);

CREATE INDEX IF NOT EXISTS idx_{municipio}_plano_codigo
    ON {municipio}.plano_regulador (codigo_zona);

CREATE INDEX IF NOT EXISTS idx_{municipio}_plano_vigente
    ON {municipio}.plano_regulador (vigente) WHERE vigente = TRUE;

CREATE OR REPLACE TRIGGER tg_{municipio}_plano_actualizado
    BEFORE UPDATE ON {municipio}.plano_regulador
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();


CREATE TABLE IF NOT EXISTS {municipio}.alumbrado (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_luminaria    VARCHAR(50),
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
    geometria           GEOMETRY(Point, 4326) NOT NULL,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT alumbrado_codigo_uq UNIQUE (codigo_luminaria)
);

CREATE INDEX IF NOT EXISTS idx_{municipio}_alumbrado_geom
    ON {municipio}.alumbrado USING GIST (geometria);

CREATE INDEX IF NOT EXISTS idx_{municipio}_alumbrado_estado
    ON {municipio}.alumbrado (estado);

CREATE INDEX IF NOT EXISTS idx_{municipio}_alumbrado_codigo
    ON {municipio}.alumbrado (codigo_luminaria)
    WHERE codigo_luminaria IS NOT NULL;

CREATE OR REPLACE TRIGGER tg_{municipio}_alumbrado_actualizado
    BEFORE UPDATE ON {municipio}.alumbrado
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();
