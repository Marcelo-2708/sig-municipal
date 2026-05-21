-- =============================================================================
-- SCRIPT: Índices espaciales GIST por municipio
-- Proyecto: SIG Municipal — Plataforma WebGIS Multi-tenant
-- Descripción: Crea o recrea los índices GIST en todas las tablas geoespaciales
--              de un municipio. Útil para mantenimiento (REINDEX) o post-carga masiva.
-- PostgreSQL 15 + PostGIS 3.4
-- Fecha: 2026-05-01
-- =============================================================================
--
-- USO:
--   Reemplazar {municipio} por el esquema real antes de ejecutar.
--
--   Ejemplo en bash:
--     sed 's/{municipio}/mun_concepcion/g' indexes_espaciales.sql | psql -U sig_app -d sig_municipal
--
--   O con psql variables:
--     psql -v municipio=mun_concepcion -c "\i indexes_espaciales.sql"
--     (requiere adaptar la sintaxis a :municipio con comillas identificadoras)
--
-- NOTA: Estos índices son creados también por template_municipio.sql durante
--       el onboarding. Usar este script para:
--       - Recrear índices corruptos (REINDEX)
--       - Reconstruir índices luego de carga masiva (COPY/INSERT sin índices)
--       - Verificar que todos los índices existen y están activos
-- =============================================================================

-- Verificar que el esquema existe antes de continuar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.schemata
        WHERE schema_name = '{municipio}'
    ) THEN
        RAISE EXCEPTION 'El esquema "%" no existe. Verificar que se ejecutó crear_municipio.sql primero.',
            '{municipio}';
    END IF;
    RAISE NOTICE 'Creando/verificando índices espaciales para esquema: %', '{municipio}';
END
$$;

-- =============================================================================
-- ÍNDICES GIST — TABLA predios
-- =============================================================================

-- Índice principal en geometría de predios (obligatorio para consultas espaciales)
DROP INDEX IF EXISTS {municipio}.idx_{municipio}_predios_geom;
CREATE INDEX idx_{municipio}_predios_geom
    ON {municipio}.predios USING GIST (geometria);

COMMENT ON INDEX {municipio}.idx_{municipio}_predios_geom
    IS 'Índice GIST en geometría de predios — requerido para ST_Contains, ST_Intersects, etc.';

-- =============================================================================
-- ÍNDICES GIST — TABLA permisos_edificacion
-- =============================================================================

-- Índice en ubicación de permisos (solo registros con geometría)
DROP INDEX IF EXISTS {municipio}.idx_{municipio}_permisos_geom;
CREATE INDEX idx_{municipio}_permisos_geom
    ON {municipio}.permisos_edificacion USING GIST (ubicacion)
    WHERE ubicacion IS NOT NULL;

COMMENT ON INDEX {municipio}.idx_{municipio}_permisos_geom
    IS 'Índice GIST en ubicación de permisos de edificación (parcial: solo registros con geometría)';

-- =============================================================================
-- ÍNDICES GIST — TABLA plano_regulador
-- =============================================================================

-- Índice en geometría del plano regulador (crítico para función zona_en_punto)
DROP INDEX IF EXISTS {municipio}.idx_{municipio}_plano_geom;
CREATE INDEX idx_{municipio}_plano_geom
    ON {municipio}.plano_regulador USING GIST (geometria);

COMMENT ON INDEX {municipio}.idx_{municipio}_plano_geom
    IS 'Índice GIST en geometría del plano regulador — requerido para zona_en_punto()';

-- =============================================================================
-- ÍNDICES GIST — TABLA alumbrado
-- =============================================================================

-- Índice en geometría de luminarias
DROP INDEX IF EXISTS {municipio}.idx_{municipio}_alumbrado_geom;
CREATE INDEX idx_{municipio}_alumbrado_geom
    ON {municipio}.alumbrado USING GIST (geometria);

COMMENT ON INDEX {municipio}.idx_{municipio}_alumbrado_geom
    IS 'Índice GIST en ubicación de luminarias de alumbrado público';

-- =============================================================================
-- ÍNDICE GIN FULL-TEXT — TABLA predios
-- (incluido aquí porque también requiere mantenimiento junto a los GIST)
-- =============================================================================

DROP INDEX IF EXISTS {municipio}.idx_{municipio}_predios_fts;
CREATE INDEX idx_{municipio}_predios_fts
    ON {municipio}.predios USING GIN (
        to_tsvector('spanish_unaccent',
            lower(unaccent(coalesce(direccion, '')))
            || ' ' || lower(unaccent(coalesce(propietario, '')))
            || ' ' || lower(unaccent(coalesce(rol_sii, '')))
        )
    );

COMMENT ON INDEX {municipio}.idx_{municipio}_predios_fts
    IS 'Índice GIN full-text en dirección+propietario+rol_sii de predios — usado por buscar_predios()';

-- =============================================================================
-- VERIFICACIÓN POST-CREACIÓN
-- Lista los índices creados con su estado
-- =============================================================================
DO $$
DECLARE
    v_indice RECORD;
    v_total  INT := 0;
    v_validos INT := 0;
BEGIN
    RAISE NOTICE '=== Verificación de índices espaciales para esquema % ===', '{municipio}';

    FOR v_indice IN
        SELECT
            i.relname AS nombre_indice,
            am.amname AS tipo,
            ix.indisvalid AS valido,
            ix.indisready AS listo
        FROM
            pg_index ix
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_am am ON am.oid = i.relam
        WHERE
            n.nspname = '{municipio}'
            AND am.amname IN ('gist', 'gin')
        ORDER BY t.relname, i.relname
    LOOP
        v_total := v_total + 1;
        IF v_indice.valido AND v_indice.listo THEN
            v_validos := v_validos + 1;
            RAISE NOTICE '  [OK] % (%)', v_indice.nombre_indice, upper(v_indice.tipo);
        ELSE
            RAISE WARNING '  [PROBLEMA] % (%) — valido: %, listo: %',
                v_indice.nombre_indice, upper(v_indice.tipo),
                v_indice.valido, v_indice.listo;
        END IF;
    END LOOP;

    RAISE NOTICE '=== Total: % índices, % válidos y activos ===', v_total, v_validos;

    IF v_total = 0 THEN
        RAISE WARNING 'No se encontraron índices GIST/GIN en el esquema %. Verificar que template_municipio.sql fue ejecutado.', '{municipio}';
    END IF;
END
$$;
