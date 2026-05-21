-- =============================================================================
-- SCRIPT: Health check de la base de datos SIG Municipal
-- Proyecto: SIG Municipal — Plataforma WebGIS Multi-tenant
-- Descripción: Verifica el estado de la base de datos:
--              - Extensiones instaladas
--              - Esquemas de municipios con conteo de tablas y tamaño
--              - Índices GIST/GIN existentes y su estado
--              - Últimas entradas del log de auditoría
-- PostgreSQL 15 + PostGIS 3.4
-- Fecha: 2026-05-01
-- =============================================================================
--
-- USO:
--   psql -U sig_app -d sig_municipal -f health_check.sql
--   o bien:
--   psql -U sig_app -d sig_municipal -c "\i database/scripts/health_check.sql"
-- =============================================================================

\echo '============================================================'
\echo ' SIG Municipal — Health Check de Base de Datos'
\echo '============================================================'
\echo ''

-- =============================================================================
-- SECCIÓN 1: Verificar extensiones instaladas
-- =============================================================================
\echo '--- [1/4] EXTENSIONES INSTALADAS ---'

SELECT
    e.extname                           AS extension,
    e.extversion                        AS version,
    n.nspname                           AS esquema,
    CASE
        WHEN e.extname IN ('postgis', 'postgis_topology', 'uuid-ossp', 'pg_trgm', 'unaccent')
        THEN 'REQUERIDA'
        ELSE 'adicional'
    END                                 AS tipo,
    'OK'                                AS estado
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY tipo DESC, e.extname;

-- Verificar extensiones requeridas faltantes
DO $$
DECLARE
    v_ext TEXT;
    v_faltantes TEXT[] := ARRAY[]::TEXT[];
    v_requeridas TEXT[] := ARRAY[
        'postgis', 'postgis_topology', 'uuid-ossp', 'pg_trgm', 'unaccent'
    ];
BEGIN
    FOREACH v_ext IN ARRAY v_requeridas LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = v_ext) THEN
            v_faltantes := array_append(v_faltantes, v_ext);
        END IF;
    END LOOP;

    IF array_length(v_faltantes, 1) > 0 THEN
        RAISE WARNING '[ALERTA] Extensiones requeridas NO instaladas: %',
            array_to_string(v_faltantes, ', ');
    ELSE
        RAISE NOTICE '[OK] Todas las extensiones requeridas están instaladas.';
    END IF;
END
$$;

-- Verificar configuración de búsqueda full-text spanish_unaccent
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'spanish_unaccent') THEN
        RAISE NOTICE '[OK] Configuración FTS spanish_unaccent disponible.';
    ELSE
        RAISE WARNING '[ALERTA] Configuración FTS spanish_unaccent NO encontrada. Ejecutar 002_extensiones.sql';
    END IF;
END
$$;

\echo ''

-- =============================================================================
-- SECCIÓN 2: Municipios activos con conteo de tablas y tamaño de esquema
-- =============================================================================
\echo '--- [2/4] ESQUEMAS DE MUNICIPIOS ---'

SELECT
    m.codigo                            AS codigo,
    m.nombre                            AS municipio,
    m.subdominio                        AS subdominio,
    m.plan                              AS plan,
    m.activo                            AS activo,
    -- Conteo de tablas en el esquema del municipio
    COALESCE(t.num_tablas, 0)           AS tablas,
    -- Tamaño total del esquema
    COALESCE(
        pg_size_pretty(s.tamano_bytes), '0 bytes'
    )                                   AS tamano_esquema,
    -- Fecha de creación del municipio
    to_char(m.creado_en, 'YYYY-MM-DD') AS creado_en
FROM public.municipios m
LEFT JOIN (
    SELECT
        table_schema,
        COUNT(*) AS num_tablas
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
    GROUP BY table_schema
) t ON t.table_schema = m.esquema_bd
LEFT JOIN (
    SELECT
        nspname,
        SUM(pg_total_relation_size(c.oid)) AS tamano_bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
    GROUP BY nspname
) s ON s.nspname = m.esquema_bd
ORDER BY m.activo DESC, m.nombre;

-- Alerta para municipios sin esquema
DO $$
DECLARE
    v_mun RECORD;
BEGIN
    FOR v_mun IN
        SELECT m.codigo, m.nombre, m.esquema_bd
        FROM public.municipios m
        WHERE m.activo = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM information_schema.schemata
              WHERE schema_name = m.esquema_bd
          )
    LOOP
        RAISE WARNING '[ALERTA] Municipio "%" (%) tiene activo=TRUE pero su esquema "%" NO existe en la BD.',
            v_mun.nombre, v_mun.codigo, v_mun.esquema_bd;
    END LOOP;
END
$$;

\echo ''

-- =============================================================================
-- SECCIÓN 3: Estado de índices GIST/GIN en todos los esquemas de municipios
-- =============================================================================
\echo '--- [3/4] ÍNDICES ESPACIALES (GIST/GIN) ---'

SELECT
    n.nspname                           AS esquema,
    t.relname                           AS tabla,
    i.relname                           AS indice,
    am.amname                           AS tipo,
    CASE
        WHEN ix.indisvalid AND ix.indisready THEN 'OK'
        WHEN NOT ix.indisvalid            THEN 'INVALIDO'
        WHEN NOT ix.indisready            THEN 'NO_LISTO'
        ELSE 'DESCONOCIDO'
    END                                 AS estado,
    pg_size_pretty(pg_relation_size(i.oid)) AS tamano
FROM pg_index ix
JOIN pg_class i  ON i.oid  = ix.indexrelid
JOIN pg_class t  ON t.oid  = ix.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_am am    ON am.oid  = i.relam
WHERE
    am.amname IN ('gist', 'gin')
    -- Solo esquemas de municipios (prefijo mun_) y schema público
    AND (n.nspname LIKE 'mun_%' OR n.nspname = 'public')
ORDER BY n.nspname, t.relname, i.relname;

-- Alerta para índices no válidos
DO $$
DECLARE
    v_idx RECORD;
    v_problemas INT := 0;
BEGIN
    FOR v_idx IN
        SELECT
            n.nspname AS esquema,
            t.relname AS tabla,
            i.relname AS indice,
            ix.indisvalid AS valido,
            ix.indisready AS listo
        FROM pg_index ix
        JOIN pg_class i  ON i.oid  = ix.indexrelid
        JOIN pg_class t  ON t.oid  = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_am am    ON am.oid  = i.relam
        WHERE
            am.amname IN ('gist', 'gin')
            AND (n.nspname LIKE 'mun_%' OR n.nspname = 'public')
            AND (NOT ix.indisvalid OR NOT ix.indisready)
    LOOP
        v_problemas := v_problemas + 1;
        RAISE WARNING '[ALERTA] Índice problemático: %.% en %.% — válido: %, listo: %',
            v_idx.esquema, v_idx.indice,
            v_idx.esquema, v_idx.tabla,
            v_idx.valido, v_idx.listo;
    END LOOP;

    IF v_problemas = 0 THEN
        RAISE NOTICE '[OK] Todos los índices GIST/GIN están válidos y activos.';
    ELSE
        RAISE WARNING '[ALERTA] Se encontraron % índice(s) con problemas. Ejecutar REINDEX para reparar.', v_problemas;
    END IF;
END
$$;

-- Verificar que los índices esperados existen para cada municipio activo
DO $$
DECLARE
    v_mun RECORD;
    v_idx_esperados TEXT[] := ARRAY['_predios_geom', '_plano_geom', '_alumbrado_geom', '_predios_fts'];
    v_sufijo TEXT;
    v_idx_name TEXT;
    v_faltantes INT := 0;
BEGIN
    FOR v_mun IN
        SELECT esquema_bd FROM public.municipios WHERE activo = TRUE
    LOOP
        -- Verificar solo si el esquema existe
        IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = v_mun.esquema_bd) THEN
            FOREACH v_sufijo IN ARRAY v_idx_esperados LOOP
                v_idx_name := 'idx_' || v_mun.esquema_bd || v_sufijo;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE schemaname = v_mun.esquema_bd
                      AND indexname = v_idx_name
                ) THEN
                    RAISE WARNING '[ALERTA] Índice faltante en esquema %: %',
                        v_mun.esquema_bd, v_idx_name;
                    v_faltantes := v_faltantes + 1;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    IF v_faltantes = 0 THEN
        RAISE NOTICE '[OK] Todos los índices espaciales esperados están presentes.';
    END IF;
END
$$;

\echo ''

-- =============================================================================
-- SECCIÓN 4: Últimas 5 entradas del log de auditoría
-- =============================================================================
\echo '--- [4/4] ÚLTIMAS ENTRADAS EN LOG_CAMBIOS ---'

SELECT
    lc.id                               AS id,
    to_char(lc.creado_en, 'YYYY-MM-DD HH24:MI:SS TZ') AS fecha,
    lc.operacion                        AS operacion,
    lc.tabla_afectada                   AS tabla,
    COALESCE(u.email, '(sistema)')      AS usuario,
    COALESCE(m.codigo, '(global)')      AS municipio,
    COALESCE(lc.descripcion, '')        AS descripcion
FROM public.log_cambios lc
LEFT JOIN public.usuarios  u ON u.id = lc.usuario_id
LEFT JOIN public.municipios m ON m.id = lc.municipio_id
ORDER BY lc.creado_en DESC
LIMIT 5;

-- =============================================================================
-- RESUMEN GENERAL
-- =============================================================================
\echo ''
\echo '--- RESUMEN ---'

SELECT
    (SELECT COUNT(*) FROM public.municipios WHERE activo = TRUE)    AS municipios_activos,
    (SELECT COUNT(*) FROM public.usuarios   WHERE activo = TRUE)    AS usuarios_activos,
    (SELECT COUNT(*) FROM public.capas      WHERE activo = TRUE)    AS capas_activas,
    (SELECT COUNT(*) FROM public.reportes_ciudadanos WHERE estado = 'pendiente') AS reportes_pendientes,
    (SELECT COUNT(*) FROM public.log_cambios)                       AS total_registros_log,
    (SELECT MAX(creado_en) FROM public.log_cambios)                 AS ultimo_cambio;

\echo ''
\echo '============================================================'
\echo ' Health check completado.'
\echo '============================================================'
