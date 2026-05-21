-- =============================================================================
-- MIGRACIÓN 002: Instalación de extensiones PostgreSQL
-- Proyecto: SIG Municipal — Plataforma WebGIS Multi-tenant
-- Descripción: Extensiones requeridas por la plataforma.
--              DEBE ejecutarse como superusuario ANTES de las demás migraciones.
-- PostgreSQL 15 + PostGIS 3.4
-- Fecha: 2026-05-01
-- =============================================================================
--
-- INSTRUCCIONES DE EJECUCIÓN:
--   psql -U postgres -d sig_municipal -f 002_extensiones.sql
--
-- ADVERTENCIA: Este script requiere privilegios de superusuario (postgres).
--              No puede ejecutarse con el rol sig_app.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- PostGIS — soporte de geometrías y funciones espaciales
-- Requerido para todas las tablas con columnas GEOMETRY/GEOGRAPHY
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;
COMMENT ON EXTENSION postgis IS 'Extensión PostGIS 3.4 — tipos y funciones geoespaciales';

-- -----------------------------------------------------------------------------
-- PostGIS Topology — soporte de topología espacial
-- Requerido para validaciones de geometría avanzadas (plano regulador)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis_topology;
COMMENT ON EXTENSION postgis_topology IS 'PostGIS Topology — soporte de topología para validación de geometrías';

-- -----------------------------------------------------------------------------
-- uuid-ossp — generación de UUIDs
-- Provee gen_random_uuid() y uuid_generate_v4()
-- PostgreSQL 13+ incluye gen_random_uuid() nativo, pero uuid-ossp agrega variantes
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
COMMENT ON EXTENSION "uuid-ossp" IS 'Generación de UUIDs (v1, v3, v4, v5)';

-- -----------------------------------------------------------------------------
-- pg_trgm — índices de trigramas para búsqueda de texto aproximada
-- Permite búsquedas ILIKE eficientes y similitud de texto
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
COMMENT ON EXTENSION pg_trgm IS 'Índices de trigramas para búsqueda de texto con similitud';

-- -----------------------------------------------------------------------------
-- unaccent — normalización de texto sin tildes/diacríticos
-- Requerido para búsqueda de predios insensible a acentos (ej: José → jose)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS unaccent;
COMMENT ON EXTENSION unaccent IS 'Eliminación de acentos y diacríticos para normalización de texto';

-- -----------------------------------------------------------------------------
-- Verificación de instalación
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_extensiones_faltantes TEXT[];
    v_ext TEXT;
    v_requeridas TEXT[] := ARRAY[
        'postgis',
        'postgis_topology',
        'uuid-ossp',
        'pg_trgm',
        'unaccent'
    ];
BEGIN
    v_extensiones_faltantes := ARRAY[]::TEXT[];

    FOREACH v_ext IN ARRAY v_requeridas LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = v_ext
        ) THEN
            v_extensiones_faltantes := array_append(v_extensiones_faltantes, v_ext);
        END IF;
    END LOOP;

    IF array_length(v_extensiones_faltantes, 1) > 0 THEN
        RAISE EXCEPTION 'Extensiones faltantes después de la instalación: %',
            array_to_string(v_extensiones_faltantes, ', ');
    ELSE
        RAISE NOTICE 'Todas las extensiones instaladas correctamente: %',
            array_to_string(v_requeridas, ', ');
    END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Configurar diccionario de búsqueda full-text en español con unaccent
-- Se usa en búsqueda de predios (003_funciones_utilidad.sql y template_municipio.sql)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    -- Crear configuración de texto en español con unaccent si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'spanish_unaccent'
    ) THEN
        CREATE TEXT SEARCH CONFIGURATION spanish_unaccent (COPY = spanish);
        ALTER TEXT SEARCH CONFIGURATION spanish_unaccent
            ALTER MAPPING FOR hword, hword_part, word
            WITH unaccent, spanish_stem;

        RAISE NOTICE 'Configuración de búsqueda spanish_unaccent creada.';
    ELSE
        RAISE NOTICE 'Configuración spanish_unaccent ya existe — sin cambios.';
    END IF;
END
$$;

COMMENT ON TEXT SEARCH CONFIGURATION spanish_unaccent
    IS 'Configuración FTS para español con normalización de acentos (unaccent + spanish_stem)';

COMMIT;

-- =============================================================================
-- ROLLBACK
-- Para revertir esta migración ejecutar el bloque siguiente:
-- ADVERTENCIA: Eliminar extensiones puede fallar si hay objetos que dependen de ellas.
-- =============================================================================
/*
BEGIN;

-- Eliminar configuración de búsqueda full-text
DROP TEXT SEARCH CONFIGURATION IF EXISTS spanish_unaccent;

-- PRECAUCIÓN: Solo ejecutar si no hay tablas con columnas GEOMETRY
-- DROP EXTENSION IF EXISTS postgis_topology;
-- DROP EXTENSION IF EXISTS postgis;

-- Las siguientes extensiones se pueden eliminar con seguridad si no hay dependencias:
-- DROP EXTENSION IF EXISTS "uuid-ossp";
-- DROP EXTENSION IF EXISTS pg_trgm;
-- DROP EXTENSION IF EXISTS unaccent;

COMMIT;
*/
