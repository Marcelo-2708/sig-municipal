-- =============================================================================
-- MIGRACIÓN 003: Funciones de utilidad PL/pgSQL
-- Proyecto: SIG Municipal — Plataforma WebGIS Multi-tenant
-- Descripción: Funciones reutilizables para búsqueda predial, análisis espacial
--              y mantenimiento de timestamps.
-- PostgreSQL 15 + PostGIS 3.4
-- Requisitos: 001_esquema_publico.sql, 002_extensiones.sql ejecutadas previamente
-- Fecha: 2026-05-01
-- =============================================================================

BEGIN;

-- =============================================================================
-- FUNCIÓN: buscar_predios
-- Búsqueda full-text de predios en el esquema de un municipio.
-- Utiliza ts_rank para ordenar por relevancia y unaccent para normalización.
--
-- Parámetros:
--   p_esquema  TEXT  — nombre del esquema del municipio (ej: 'mun_concepcion')
--   p_texto    TEXT  — texto a buscar (dirección, rol, propietario)
--   p_limite   INT   — número máximo de resultados (default 20, máximo 100)
--
-- Retorna: tabla con id, rol_sii, direccion, propietario, ranking y geometría
-- =============================================================================
CREATE OR REPLACE FUNCTION public.buscar_predios(
    p_esquema   TEXT,
    p_texto     TEXT,
    p_limite    INT DEFAULT 20
)
RETURNS TABLE (
    id              UUID,
    rol_sii         VARCHAR,
    direccion       TEXT,
    propietario     TEXT,
    ranking         FLOAT4,
    ubicacion       GEOMETRY
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_sql           TEXT;
    v_query_tsv     TSQUERY;
    v_texto_limpio  TEXT;
BEGIN
    -- Validar parámetros de entrada
    IF p_esquema IS NULL OR LENGTH(TRIM(p_esquema)) = 0 THEN
        RAISE EXCEPTION 'buscar_predios: el parámetro p_esquema no puede estar vacío';
    END IF;

    IF p_texto IS NULL OR LENGTH(TRIM(p_texto)) = 0 THEN
        RAISE EXCEPTION 'buscar_predios: el parámetro p_texto no puede estar vacío';
    END IF;

    -- Sanitizar nombre del esquema para evitar inyección SQL
    IF p_esquema !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' THEN
        RAISE EXCEPTION 'buscar_predios: nombre de esquema inválido: %', p_esquema;
    END IF;

    -- Limitar el número de resultados para proteger el rendimiento
    IF p_limite IS NULL OR p_limite < 1 THEN
        p_limite := 20;
    ELSIF p_limite > 100 THEN
        p_limite := 100;
    END IF;

    -- Verificar que el esquema existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.schemata
        WHERE schema_name = p_esquema
    ) THEN
        RAISE EXCEPTION 'buscar_predios: el esquema "%" no existe en la base de datos', p_esquema;
    END IF;

    -- Verificar que la tabla predios existe en el esquema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = p_esquema AND table_name = 'predios'
    ) THEN
        RAISE EXCEPTION 'buscar_predios: la tabla "predios" no existe en el esquema "%"', p_esquema;
    END IF;

    -- Normalizar texto de búsqueda: minúsculas, sin acentos
    v_texto_limpio := lower(unaccent(TRIM(p_texto)));

    -- Construir tsquery en español con manejo de errores
    BEGIN
        v_query_tsv := plainto_tsquery('spanish_unaccent', v_texto_limpio);
    EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'buscar_predios: texto de búsqueda inválido: % (error: %)',
            p_texto, SQLERRM;
    END;

    -- Construir consulta dinámica parametrizada con ranking ts_rank
    v_sql := format(
        $query$
        SELECT
            p.id::UUID,
            p.rol_sii::VARCHAR,
            p.direccion::TEXT,
            p.propietario::TEXT,
            ts_rank(
                to_tsvector('spanish_unaccent', lower(unaccent(coalesce(p.direccion, '')))
                    || ' ' || lower(unaccent(coalesce(p.propietario, '')))
                    || ' ' || lower(unaccent(coalesce(p.rol_sii, '')))),
                $1
            )::FLOAT4 AS ranking,
            p.geometria AS ubicacion
        FROM %I.predios p
        WHERE
            to_tsvector('spanish_unaccent',
                lower(unaccent(coalesce(p.direccion, '')))
                || ' ' || lower(unaccent(coalesce(p.propietario, '')))
                || ' ' || lower(unaccent(coalesce(p.rol_sii, '')))
            ) @@ $1
            OR p.direccion_normalizada ILIKE $2
        ORDER BY ranking DESC
        LIMIT $3
        $query$,
        p_esquema
    );

    -- Ejecutar la consulta y retornar resultados
    RETURN QUERY EXECUTE v_sql
        USING v_query_tsv, '%' || v_texto_limpio || '%', p_limite;

EXCEPTION
    WHEN undefined_table THEN
        RAISE EXCEPTION 'buscar_predios: tabla de predios no encontrada en esquema "%"', p_esquema;
    WHEN undefined_column THEN
        RAISE EXCEPTION 'buscar_predios: columna faltante en tabla predios del esquema "%". Verificar template_municipio.sql', p_esquema;
END;
$$;

COMMENT ON FUNCTION public.buscar_predios(TEXT, TEXT, INT) IS
    'Búsqueda full-text de predios en el esquema de un municipio. '
    'Usa ts_rank con configuración spanish_unaccent para resultados ordenados por relevancia.';

-- Otorgar permisos de ejecución al rol de aplicación
GRANT EXECUTE ON FUNCTION public.buscar_predios(TEXT, TEXT, INT) TO sig_app;


-- =============================================================================
-- FUNCIÓN: zona_en_punto
-- Determina en qué zona del plano regulador cae un punto geográfico.
-- Útil para consultas ciudadanas sobre uso de suelo permitido.
--
-- Parámetros:
--   p_esquema  TEXT   — nombre del esquema del municipio
--   p_lat      FLOAT8 — latitud en WGS84 (EPSG:4326)
--   p_lon      FLOAT8 — longitud en WGS84 (EPSG:4326)
--
-- Retorna: tabla con los atributos de la zona del plano regulador
-- =============================================================================
CREATE OR REPLACE FUNCTION public.zona_en_punto(
    p_esquema   TEXT,
    p_lat       FLOAT8,
    p_lon       FLOAT8
)
RETURNS TABLE (
    zona_id         UUID,
    codigo_zona     VARCHAR,
    nombre_zona     VARCHAR,
    uso_permitido   TEXT,
    coeficiente_occ NUMERIC,
    altura_maxima   NUMERIC,
    observaciones   TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_sql       TEXT;
    v_punto     GEOMETRY;
BEGIN
    -- Validar parámetros de entrada
    IF p_esquema IS NULL OR LENGTH(TRIM(p_esquema)) = 0 THEN
        RAISE EXCEPTION 'zona_en_punto: el parámetro p_esquema no puede estar vacío';
    END IF;

    -- Sanitizar nombre del esquema
    IF p_esquema !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' THEN
        RAISE EXCEPTION 'zona_en_punto: nombre de esquema inválido: %', p_esquema;
    END IF;

    -- Validar coordenadas geográficas
    IF p_lat IS NULL OR p_lon IS NULL THEN
        RAISE EXCEPTION 'zona_en_punto: las coordenadas lat/lon no pueden ser NULL';
    END IF;

    IF p_lat < -90.0 OR p_lat > 90.0 THEN
        RAISE EXCEPTION 'zona_en_punto: latitud fuera de rango [-90, 90]: %', p_lat;
    END IF;

    IF p_lon < -180.0 OR p_lon > 180.0 THEN
        RAISE EXCEPTION 'zona_en_punto: longitud fuera de rango [-180, 180]: %', p_lon;
    END IF;

    -- Verificar que el esquema existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.schemata
        WHERE schema_name = p_esquema
    ) THEN
        RAISE EXCEPTION 'zona_en_punto: el esquema "%" no existe', p_esquema;
    END IF;

    -- Verificar que la tabla plano_regulador existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = p_esquema AND table_name = 'plano_regulador'
    ) THEN
        RAISE EXCEPTION 'zona_en_punto: tabla "plano_regulador" no encontrada en esquema "%"', p_esquema;
    END IF;

    -- Construir el punto en EPSG:4326 (lon, lat — orden X,Y en PostGIS)
    v_punto := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);

    -- Consulta dinámica: intersección punto con polígonos del plano regulador
    v_sql := format(
        $query$
        SELECT
            pr.id::UUID,
            pr.codigo_zona::VARCHAR,
            pr.nombre_zona::VARCHAR,
            pr.uso_permitido::TEXT,
            pr.coeficiente_ocupacion::NUMERIC,
            pr.altura_maxima_m::NUMERIC,
            pr.observaciones::TEXT
        FROM %I.plano_regulador pr
        WHERE ST_Contains(pr.geometria, $1)
        ORDER BY ST_Area(pr.geometria::geography) ASC  -- zona más pequeña primero (más específica)
        LIMIT 5
        $query$,
        p_esquema
    );

    RETURN QUERY EXECUTE v_sql USING v_punto;

EXCEPTION
    WHEN undefined_table THEN
        RAISE EXCEPTION 'zona_en_punto: tabla plano_regulador no encontrada en esquema "%"', p_esquema;
    WHEN undefined_column THEN
        RAISE EXCEPTION 'zona_en_punto: columna faltante en plano_regulador del esquema "%". Verificar template_municipio.sql', p_esquema;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'zona_en_punto: error inesperado — esquema: %, lat: %, lon: %, detalle: %',
            p_esquema, p_lat, p_lon, SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.zona_en_punto(TEXT, FLOAT8, FLOAT8) IS
    'Retorna la(s) zona(s) del plano regulador que contienen el punto dado. '
    'Las coordenadas deben estar en EPSG:4326 (WGS84). '
    'Retorna múltiples zonas ordenadas de menor a mayor área (más específica primero).';

GRANT EXECUTE ON FUNCTION public.zona_en_punto(TEXT, FLOAT8, FLOAT8) TO sig_app;


-- =============================================================================
-- FUNCIÓN: actualizar_timestamp (trigger function)
-- Actualiza automáticamente la columna actualizado_en antes de cada UPDATE.
-- Esta función es idempotente con la definida en 001_esquema_publico.sql
-- (CREATE OR REPLACE garantiza que se usa la versión más reciente).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_actualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Actualizar columna de timestamp de modificación
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_actualizar_timestamp() IS
    'Función trigger que establece actualizado_en = NOW() en cada UPDATE. '
    'Debe usarse con: BEFORE UPDATE FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_timestamp()';

-- No se otorga EXECUTE al rol sig_app — los triggers la ejecutan con los permisos del owner


-- =============================================================================
-- FUNCIÓN AUXILIAR: registrar_log_cambio
-- Inserta una entrada de auditoría en log_cambios.
-- Centraliza el logging para asegurar consistencia de formato.
--
-- Parámetros:
--   p_usuario_id     UUID   — ID del usuario que ejecuta la acción (puede ser NULL)
--   p_municipio_id   UUID   — ID del municipio afectado (puede ser NULL)
--   p_tabla          TEXT   — nombre de la tabla afectada
--   p_operacion      TEXT   — tipo de operación (INSERT, UPDATE, DELETE, LOGIN, etc.)
--   p_registro_id    TEXT   — ID del registro afectado
--   p_datos_ant      JSONB  — datos anteriores (para UPDATE/DELETE)
--   p_datos_new      JSONB  — datos nuevos (para INSERT/UPDATE)
--   p_descripcion    TEXT   — descripción legible del cambio
-- =============================================================================
CREATE OR REPLACE FUNCTION public.registrar_log_cambio(
    p_usuario_id    UUID,
    p_municipio_id  UUID,
    p_tabla         TEXT,
    p_operacion     TEXT,
    p_registro_id   TEXT    DEFAULT NULL,
    p_datos_ant     JSONB   DEFAULT NULL,
    p_datos_new     JSONB   DEFAULT NULL,
    p_descripcion   TEXT    DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id BIGINT;
BEGIN
    -- Validar parámetros obligatorios
    IF p_tabla IS NULL OR LENGTH(TRIM(p_tabla)) = 0 THEN
        RAISE EXCEPTION 'registrar_log_cambio: p_tabla no puede estar vacío';
    END IF;

    IF p_operacion NOT IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ERROR') THEN
        RAISE EXCEPTION 'registrar_log_cambio: operación inválida "%" — valores permitidos: INSERT, UPDATE, DELETE, LOGIN, LOGOUT, ERROR',
            p_operacion;
    END IF;

    INSERT INTO public.log_cambios (
        usuario_id,
        municipio_id,
        tabla_afectada,
        operacion,
        registro_id,
        datos_anteriores,
        datos_nuevos,
        ip_origen,
        descripcion
    )
    VALUES (
        p_usuario_id,
        p_municipio_id,
        p_tabla,
        p_operacion,
        p_registro_id,
        p_datos_ant,
        p_datos_new,
        inet_client_addr(),  -- IP del cliente que ejecuta la consulta
        p_descripcion
    )
    RETURNING id INTO v_id;

    RETURN v_id;

EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION 'registrar_log_cambio: usuario_id o municipio_id no existen en la base de datos. Detalle: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'registrar_log_cambio: error al insertar en log_cambios — %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.registrar_log_cambio(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) IS
    'Inserta una entrada de auditoría en log_cambios. '
    'Centraliza el formato del log para consistencia en toda la aplicación. '
    'Retorna el ID (BIGINT) del registro creado.';

GRANT EXECUTE ON FUNCTION public.registrar_log_cambio(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT) TO sig_app;

COMMIT;

-- =============================================================================
-- ROLLBACK
-- Para revertir esta migración ejecutar el bloque siguiente:
-- =============================================================================
/*
BEGIN;

DROP FUNCTION IF EXISTS public.registrar_log_cambio(UUID, UUID, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.fn_actualizar_timestamp();
DROP FUNCTION IF EXISTS public.zona_en_punto(TEXT, FLOAT8, FLOAT8);
DROP FUNCTION IF EXISTS public.buscar_predios(TEXT, TEXT, INT);

COMMIT;
*/
