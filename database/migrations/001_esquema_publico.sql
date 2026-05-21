-- =============================================================================
-- MIGRACIÓN 001: Esquema público compartido
-- Proyecto: SIG Municipal — Plataforma WebGIS Multi-tenant
-- Descripción: Tablas compartidas entre todos los municipios (multi-tenant)
-- PostgreSQL 15 + PostGIS 3.4
-- Fecha: 2026-05-01
-- =============================================================================

-- NOTA: Las extensiones deben instalarse con superusuario (ver 002_extensiones.sql)
-- Esta migración asume que las extensiones ya están instaladas.

BEGIN;

-- -----------------------------------------------------------------------------
-- ROL DE APLICACIÓN
-- Permisos mínimos necesarios para la aplicación (principio de menor privilegio)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sig_app') THEN
        CREATE ROLE sig_app WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE;
        COMMENT ON ROLE sig_app IS 'Rol de aplicación SIG Municipal — permisos mínimos';
    END IF;
END
$$;

-- La contraseña se establece vía variable de entorno en el proceso de despliegue:
-- ALTER ROLE sig_app PASSWORD :'db_password_sig_app';

-- -----------------------------------------------------------------------------
-- TABLA: municipios
-- Registro de cada municipalidad en la plataforma (un tenant = un municipio)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.municipios (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          VARCHAR(20) NOT NULL,
    nombre          VARCHAR(200) NOT NULL,
    subdominio      VARCHAR(100) NOT NULL,
    region          VARCHAR(100),
    provincia       VARCHAR(100),
    esquema_bd      VARCHAR(63) NOT NULL,          -- nombre del esquema PostgreSQL del municipio
    activo          BOOLEAN     NOT NULL DEFAULT TRUE,
    plan            VARCHAR(50) NOT NULL DEFAULT 'basico'
                                CHECK (plan IN ('basico', 'estandar', 'premium')),
    config          JSONB       NOT NULL DEFAULT '{}'::jsonb, -- configuración específica del tenant
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT municipios_codigo_uq     UNIQUE (codigo),
    CONSTRAINT municipios_subdominio_uq UNIQUE (subdominio),
    CONSTRAINT municipios_esquema_uq    UNIQUE (esquema_bd),
    CONSTRAINT municipios_codigo_fmt    CHECK (codigo ~ '^[a-z0-9_-]+$'),
    CONSTRAINT municipios_subdominio_fmt CHECK (subdominio ~ '^[a-z0-9-]+$'),
    CONSTRAINT municipios_esquema_fmt   CHECK (esquema_bd ~ '^mun_[a-z0-9_]+$')
);

COMMENT ON TABLE  public.municipios                IS 'Registro de municipios — cada fila es un tenant independiente';
COMMENT ON COLUMN public.municipios.codigo         IS 'Código único corto, ej: concepcion, chiguayante';
COMMENT ON COLUMN public.municipios.subdominio     IS 'Subdominio para acceso web, ej: concepcion → sig.concepcion.cl';
COMMENT ON COLUMN public.municipios.esquema_bd     IS 'Nombre del esquema PostgreSQL donde se almacenan las capas del municipio';
COMMENT ON COLUMN public.municipios.config         IS 'Configuración JSONB: logo, colores, capas visibles por defecto, etc.';

-- -----------------------------------------------------------------------------
-- TABLA: usuarios
-- Usuarios del sistema (funcionarios municipales y super admins)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio_id    UUID        REFERENCES public.municipios(id) ON DELETE SET NULL,
    email           VARCHAR(320) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,          -- bcrypt hash, nunca en texto plano
    nombre          VARCHAR(200) NOT NULL,
    rol             VARCHAR(50) NOT NULL DEFAULT 'visor'
                                CHECK (rol IN ('super_admin', 'admin_municipio', 'editor', 'visor')),
    activo          BOOLEAN     NOT NULL DEFAULT TRUE,
    ultimo_acceso   TIMESTAMPTZ,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT usuarios_email_uq        UNIQUE (email),
    CONSTRAINT usuarios_email_fmt       CHECK (email ~* '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$'),
    CONSTRAINT usuarios_nombre_novacias CHECK (LENGTH(TRIM(nombre)) > 0)
);

COMMENT ON TABLE  public.usuarios               IS 'Usuarios del sistema: funcionarios municipales y administradores';
COMMENT ON COLUMN public.usuarios.municipio_id  IS 'NULL para super_admin (acceso a todos los municipios)';
COMMENT ON COLUMN public.usuarios.password_hash IS 'Hash bcrypt — NUNCA almacenar contraseña en texto plano';
COMMENT ON COLUMN public.usuarios.rol           IS 'super_admin: plataforma completa | admin_municipio: su municipio | editor: editar capas | visor: solo lectura';

-- -----------------------------------------------------------------------------
-- TABLA: capas
-- Metadatos de cada capa publicada en GeoServer
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.capas (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio_id    UUID        NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
    nombre_interno  VARCHAR(100) NOT NULL,          -- identificador en GeoServer
    nombre_visible  VARCHAR(200) NOT NULL,          -- nombre para mostrar al usuario
    tipo            VARCHAR(50) NOT NULL
                    CHECK (tipo IN ('wms', 'wfs', 'geojson', 'mvt', 'raster')),
    tabla_origen    VARCHAR(100),                   -- tabla en el esquema del municipio (si aplica)
    url_wms         TEXT,                           -- endpoint WMS completo
    url_wfs         TEXT,                           -- endpoint WFS completo
    estilo_sld      TEXT,                           -- nombre del estilo en GeoServer
    bbox_minx       DOUBLE PRECISION,
    bbox_miny       DOUBLE PRECISION,
    bbox_maxx       DOUBLE PRECISION,
    bbox_maxy       DOUBLE PRECISION,
    epsg            INTEGER     NOT NULL DEFAULT 4326, -- sistema de referencia
    visible_por_defecto BOOLEAN NOT NULL DEFAULT FALSE,
    orden           SMALLINT    NOT NULL DEFAULT 0,
    metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    activo          BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_por      UUID        REFERENCES public.usuarios(id) ON DELETE SET NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT capas_nombre_municipio_uq UNIQUE (municipio_id, nombre_interno),
    CONSTRAINT capas_nombre_interno_fmt  CHECK (nombre_interno ~ '^[a-z0-9_]+$'),
    CONSTRAINT capas_epsg_valido         CHECK (epsg > 0),
    CONSTRAINT capas_bbox_consistente    CHECK (
        (bbox_minx IS NULL AND bbox_miny IS NULL AND bbox_maxx IS NULL AND bbox_maxy IS NULL)
        OR
        (bbox_minx IS NOT NULL AND bbox_miny IS NOT NULL AND bbox_maxx IS NOT NULL AND bbox_maxy IS NOT NULL
         AND bbox_minx < bbox_maxx AND bbox_miny < bbox_maxy)
    )
);

COMMENT ON TABLE  public.capas                    IS 'Metadatos de capas geoespaciales publicadas en GeoServer por municipio';
COMMENT ON COLUMN public.capas.nombre_interno     IS 'Identificador de la capa en GeoServer (workspace:layer)';
COMMENT ON COLUMN public.capas.tabla_origen       IS 'Nombre de la tabla en el esquema del municipio que alimenta esta capa';
COMMENT ON COLUMN public.capas.metadata           IS 'Metadatos adicionales: descripción, fuente, fecha actualización, etc.';

-- -----------------------------------------------------------------------------
-- TABLA: refresh_tokens
-- Tokens de refresco para JWT (rotación de tokens)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,          -- hash SHA-256 del token — nunca el token en crudo
    expira_en       TIMESTAMPTZ NOT NULL,
    revocado        BOOLEAN     NOT NULL DEFAULT FALSE,
    ip_origen       INET,
    user_agent      TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT refresh_tokens_token_uq UNIQUE (token_hash),
    CONSTRAINT refresh_tokens_expira_futuro CHECK (expira_en > creado_en)
);

COMMENT ON TABLE  public.refresh_tokens            IS 'Tokens de refresco JWT — se almacena solo el hash SHA-256';
COMMENT ON COLUMN public.refresh_tokens.token_hash IS 'Hash SHA-256 del refresh token — NUNCA almacenar el token en crudo';

-- -----------------------------------------------------------------------------
-- TABLA: log_cambios
-- Auditoría de todas las operaciones críticas del sistema
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.log_cambios (
    id              BIGSERIAL   PRIMARY KEY,
    usuario_id      UUID        REFERENCES public.usuarios(id) ON DELETE SET NULL,
    municipio_id    UUID        REFERENCES public.municipios(id) ON DELETE SET NULL,
    tabla_afectada  VARCHAR(100) NOT NULL,
    operacion       VARCHAR(20) NOT NULL
                    CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ERROR')),
    registro_id     TEXT,                           -- id del registro afectado (TEXT para versatilidad)
    datos_anteriores JSONB,                         -- snapshot antes del cambio (UPDATE/DELETE)
    datos_nuevos     JSONB,                         -- snapshot después del cambio (INSERT/UPDATE)
    ip_origen       INET,
    descripcion     TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.log_cambios                  IS 'Auditoría de operaciones críticas — append-only, nunca modificar';
COMMENT ON COLUMN public.log_cambios.datos_anteriores IS 'Estado previo del registro (para UPDATE y DELETE)';
COMMENT ON COLUMN public.log_cambios.datos_nuevos     IS 'Estado nuevo del registro (para INSERT y UPDATE)';

-- -----------------------------------------------------------------------------
-- TABLA: reportes_ciudadanos
-- Reportes enviados por ciudadanos desde el mapa público
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reportes_ciudadanos (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    municipio_id    UUID        NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
    categoria       VARCHAR(100) NOT NULL
                    CHECK (categoria IN (
                        'luminaria', 'bache', 'arbol', 'basura',
                        'semaforo', 'señaletica', 'otro'
                    )),
    descripcion     TEXT        NOT NULL,
    ubicacion       GEOMETRY(Point, 4326) NOT NULL,  -- punto en WGS84
    direccion_aprox VARCHAR(500),
    nombre_contacto VARCHAR(200),
    email_contacto  VARCHAR(320),
    telefono        VARCHAR(20),
    estado          VARCHAR(50) NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'en_proceso', 'resuelto', 'rechazado')),
    prioridad       SMALLINT    NOT NULL DEFAULT 2
                    CHECK (prioridad BETWEEN 1 AND 5),  -- 1=alta, 5=baja
    asignado_a      UUID        REFERENCES public.usuarios(id) ON DELETE SET NULL,
    resolucion      TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reportes_descripcion_novacias CHECK (LENGTH(TRIM(descripcion)) >= 10),
    CONSTRAINT reportes_email_fmt CHECK (
        email_contacto IS NULL
        OR email_contacto ~* '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$'
    )
);

COMMENT ON TABLE  public.reportes_ciudadanos          IS 'Reportes de problemas urbanos enviados por ciudadanos desde el mapa';
COMMENT ON COLUMN public.reportes_ciudadanos.ubicacion IS 'Geometría punto en EPSG:4326 (WGS84)';
COMMENT ON COLUMN public.reportes_ciudadanos.prioridad IS '1=muy alta, 2=alta, 3=media, 4=baja, 5=muy baja';

-- =============================================================================
-- ÍNDICES
-- =============================================================================

-- municipios
CREATE INDEX IF NOT EXISTS idx_municipios_subdominio    ON public.municipios (subdominio);
CREATE INDEX IF NOT EXISTS idx_municipios_activo        ON public.municipios (activo) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_municipios_codigo        ON public.municipios (codigo);

-- usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_email           ON public.usuarios (email);
CREATE INDEX IF NOT EXISTS idx_usuarios_municipio_id    ON public.usuarios (municipio_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol             ON public.usuarios (rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo          ON public.usuarios (activo) WHERE activo = TRUE;

-- capas
CREATE INDEX IF NOT EXISTS idx_capas_municipio_id       ON public.capas (municipio_id);
CREATE INDEX IF NOT EXISTS idx_capas_activo             ON public.capas (activo) WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS idx_capas_tipo               ON public.capas (tipo);
CREATE INDEX IF NOT EXISTS idx_capas_orden              ON public.capas (municipio_id, orden);

-- refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario   ON public.refresh_tokens (usuario_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expira    ON public.refresh_tokens (expira_en);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_activos   ON public.refresh_tokens (usuario_id, expira_en)
    WHERE revocado = FALSE;

-- log_cambios
CREATE INDEX IF NOT EXISTS idx_log_cambios_usuario      ON public.log_cambios (usuario_id);
CREATE INDEX IF NOT EXISTS idx_log_cambios_municipio    ON public.log_cambios (municipio_id);
CREATE INDEX IF NOT EXISTS idx_log_cambios_tabla        ON public.log_cambios (tabla_afectada);
CREATE INDEX IF NOT EXISTS idx_log_cambios_creado_en    ON public.log_cambios (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_log_cambios_operacion    ON public.log_cambios (operacion);

-- reportes_ciudadanos
CREATE INDEX IF NOT EXISTS idx_reportes_municipio       ON public.reportes_ciudadanos (municipio_id);
CREATE INDEX IF NOT EXISTS idx_reportes_estado          ON public.reportes_ciudadanos (estado);
CREATE INDEX IF NOT EXISTS idx_reportes_categoria       ON public.reportes_ciudadanos (categoria);
CREATE INDEX IF NOT EXISTS idx_reportes_creado_en       ON public.reportes_ciudadanos (creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_reportes_ubicacion       ON public.reportes_ciudadanos USING GIST (ubicacion);
CREATE INDEX IF NOT EXISTS idx_reportes_asignado        ON public.reportes_ciudadanos (asignado_a)
    WHERE asignado_a IS NOT NULL;

-- =============================================================================
-- TRIGGERS DE actualizado_en
-- Se aplican a tablas que pueden ser modificadas (no al log de auditoría)
-- =============================================================================

-- La función trigger se define en 003_funciones_utilidad.sql
-- Aquí se crean los triggers asumiendo que la función ya existe.
-- Para ejecutar esta migración de forma aislada, la función se incluye inline:

CREATE OR REPLACE FUNCTION public.fn_actualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_actualizar_timestamp IS 'Trigger que actualiza automáticamente la columna actualizado_en';

CREATE OR REPLACE TRIGGER tg_municipios_actualizado_en
    BEFORE UPDATE ON public.municipios
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();

CREATE OR REPLACE TRIGGER tg_usuarios_actualizado_en
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();

CREATE OR REPLACE TRIGGER tg_capas_actualizado_en
    BEFORE UPDATE ON public.capas
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();

CREATE OR REPLACE TRIGGER tg_reportes_actualizado_en
    BEFORE UPDATE ON public.reportes_ciudadanos
    FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp();

-- =============================================================================
-- PERMISOS PARA rol sig_app
-- Permisos mínimos: SELECT, INSERT, UPDATE en tablas operacionales
-- DELETE solo donde es requerido por el flujo de negocio
-- =============================================================================

GRANT USAGE ON SCHEMA public TO sig_app;

-- municipios: solo lectura para la app (alta desde panel de administración)
GRANT SELECT ON public.municipios TO sig_app;

-- usuarios: lectura, inserción y actualización (sin borrado — baja lógica con activo=FALSE)
GRANT SELECT, INSERT, UPDATE ON public.usuarios TO sig_app;

-- capas: gestión completa de metadatos
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capas TO sig_app;

-- refresh_tokens: ciclo de vida completo
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refresh_tokens TO sig_app;

-- log_cambios: solo inserción (append-only de auditoría)
GRANT SELECT, INSERT ON public.log_cambios TO sig_app;
GRANT USAGE ON SEQUENCE public.log_cambios_id_seq TO sig_app;

-- reportes_ciudadanos: gestión completa
GRANT SELECT, INSERT, UPDATE ON public.reportes_ciudadanos TO sig_app;

COMMIT;

-- =============================================================================
-- ROLLBACK
-- Para revertir esta migración ejecutar el bloque siguiente:
-- =============================================================================
/*
BEGIN;

-- Eliminar triggers
DROP TRIGGER IF EXISTS tg_reportes_actualizado_en    ON public.reportes_ciudadanos;
DROP TRIGGER IF EXISTS tg_capas_actualizado_en       ON public.capas;
DROP TRIGGER IF EXISTS tg_usuarios_actualizado_en    ON public.usuarios;
DROP TRIGGER IF EXISTS tg_municipios_actualizado_en  ON public.municipios;

-- Eliminar función trigger (si no la usa 003_funciones_utilidad.sql)
DROP FUNCTION IF EXISTS public.fn_actualizar_timestamp();

-- Eliminar tablas (en orden inverso por dependencias)
DROP TABLE IF EXISTS public.reportes_ciudadanos;
DROP TABLE IF EXISTS public.log_cambios;
DROP TABLE IF EXISTS public.refresh_tokens;
DROP TABLE IF EXISTS public.capas;
DROP TABLE IF EXISTS public.usuarios;
DROP TABLE IF EXISTS public.municipios;

-- Eliminar rol (solo si no tiene dependencias)
DROP ROLE IF EXISTS sig_app;

COMMIT;
*/
