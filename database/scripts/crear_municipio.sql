-- =============================================================================
-- SCRIPT: Crear nuevo municipio (onboarding de tenant)
-- Proyecto: SIG Municipal — Plataforma WebGIS Multi-tenant
-- Descripción: Provisiona un nuevo municipio en la plataforma:
--              1. Crea el esquema PostgreSQL del municipio
--              2. Ejecuta el template de tablas espaciales
--              3. Otorga permisos al rol sig_app
--              4. Registra el municipio en public.municipios
-- PostgreSQL 15 + PostGIS 3.4
-- Fecha: 2026-05-01
-- =============================================================================
--
-- USO (con psql):
--   psql -U postgres -d sig_municipal \
--     -v municipio=mun_concepcion \
--     -v codigo=concepcion \
--     -v nombre="Municipalidad de Concepción" \
--     -v subdominio=concepcion \
--     -v region="Región del Biobío" \
--     -v provincia=Concepcion \
--     -v plan=estandar \
--     -f crear_municipio.sql
--
-- VARIABLES PSQL REQUERIDAS:
--   :municipio   — nombre del esquema PostgreSQL (ej: mun_concepcion)
--   :codigo      — código corto único del municipio (ej: concepcion)
--   :nombre      — nombre oficial del municipio
--   :subdominio  — subdominio web (ej: concepcion → sig.concepcion.cl)
--   :region      — región de Chile
--   :provincia   — provincia
--   :plan        — plan SaaS: basico | estandar | premium
--
-- NOTA: Requiere privilegios de superusuario para CREATE SCHEMA y GRANT.
-- =============================================================================

\set ON_ERROR_STOP on

-- Verificar que las variables obligatorias están definidas
\if :{?municipio}
\else
  \echo 'ERROR: Variable :municipio no definida. Usar -v municipio=mun_<codigo>'
  \quit
\endif

\if :{?codigo}
\else
  \echo 'ERROR: Variable :codigo no definida. Usar -v codigo=<codigo>'
  \quit
\endif

\if :{?nombre}
\else
  \echo 'ERROR: Variable :nombre no definida. Usar -v nombre="Nombre del Municipio"'
  \quit
\endif

\if :{?subdominio}
\else
  \echo 'ERROR: Variable :subdominio no definida. Usar -v subdominio=<subdominio>'
  \quit
\endif

\echo 'Iniciando onboarding de municipio: ' :nombre ' (esquema: ' :municipio ')'

-- =============================================================================
-- BLOQUE PRINCIPAL: Crear esquema y tablas del municipio
-- =============================================================================
DO $onboarding$
DECLARE
    v_municipio     TEXT := :'municipio';
    v_codigo        TEXT := :'codigo';
    v_nombre        TEXT := :'nombre';
    v_subdominio    TEXT := :'subdominio';
    v_region        TEXT := :'region';
    v_provincia     TEXT := :'provincia';
    v_plan          TEXT := COALESCE(NULLIF(:'plan', ''), 'basico');
    v_municipio_id  UUID;

BEGIN
    -- ------------------------------------------------------------------
    -- PASO 1: Validaciones previas
    -- ------------------------------------------------------------------
    RAISE NOTICE '[1/5] Validando parámetros de entrada...';

    -- Validar formato del nombre del esquema
    IF v_municipio !~ '^mun_[a-z0-9_]+$' THEN
        RAISE EXCEPTION 'crear_municipio: nombre de esquema inválido "%" — debe ser mun_<codigo_letras_numeros>',
            v_municipio;
    END IF;

    -- Validar código del municipio
    IF v_codigo !~ '^[a-z0-9_-]+$' THEN
        RAISE EXCEPTION 'crear_municipio: código inválido "%" — solo letras minúsculas, números, guión y guión bajo',
            v_codigo;
    END IF;

    -- Validar subdominio
    IF v_subdominio !~ '^[a-z0-9-]+$' THEN
        RAISE EXCEPTION 'crear_municipio: subdominio inválido "%" — solo letras minúsculas, números y guión',
            v_subdominio;
    END IF;

    -- Validar plan
    IF v_plan NOT IN ('basico', 'estandar', 'premium') THEN
        RAISE EXCEPTION 'crear_municipio: plan inválido "%" — valores permitidos: basico, estandar, premium',
            v_plan;
    END IF;

    -- Verificar que el municipio no exista ya
    IF EXISTS (SELECT 1 FROM public.municipios WHERE codigo = v_codigo) THEN
        RAISE EXCEPTION 'crear_municipio: ya existe un municipio con código "%"', v_codigo;
    END IF;

    IF EXISTS (SELECT 1 FROM public.municipios WHERE subdominio = v_subdominio) THEN
        RAISE EXCEPTION 'crear_municipio: ya existe un municipio con subdominio "%"', v_subdominio;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = v_municipio) THEN
        RAISE EXCEPTION 'crear_municipio: el esquema "%" ya existe en la base de datos', v_municipio;
    END IF;

    RAISE NOTICE '[1/5] Validaciones OK';

    -- ------------------------------------------------------------------
    -- PASO 2: Crear esquema PostgreSQL
    -- ------------------------------------------------------------------
    RAISE NOTICE '[2/5] Creando esquema: %', v_municipio;

    EXECUTE format('CREATE SCHEMA %I', v_municipio);
    EXECUTE format('COMMENT ON SCHEMA %I IS %L',
        v_municipio,
        'Esquema de datos espaciales — ' || v_nombre);

    RAISE NOTICE '[2/5] Esquema creado';

    -- ------------------------------------------------------------------
    -- PASO 3: Registrar municipio en public.municipios
    -- ------------------------------------------------------------------
    RAISE NOTICE '[3/5] Registrando municipio en public.municipios...';

    INSERT INTO public.municipios (
        codigo,
        nombre,
        subdominio,
        region,
        provincia,
        esquema_bd,
        activo,
        plan,
        config
    )
    VALUES (
        v_codigo,
        v_nombre,
        v_subdominio,
        NULLIF(v_region, ''),
        NULLIF(v_provincia, ''),
        v_municipio,
        TRUE,
        v_plan,
        jsonb_build_object(
            'centro_mapa', jsonb_build_object('lat', -35.6, 'lon', -71.5, 'zoom', 12),
            'descripcion', 'Configuración inicial de ' || v_nombre
        )
    )
    RETURNING id INTO v_municipio_id;

    RAISE NOTICE '[3/5] Municipio registrado con ID: %', v_municipio_id;

    -- ------------------------------------------------------------------
    -- PASO 4: Otorgar permisos al rol sig_app
    -- ------------------------------------------------------------------
    RAISE NOTICE '[4/5] Otorgando permisos a sig_app en esquema %...', v_municipio;

    EXECUTE format('GRANT USAGE ON SCHEMA %I TO sig_app', v_municipio);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO sig_app', v_municipio);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sig_app', v_municipio);

    RAISE NOTICE '[4/5] Permisos otorgados';

    -- ------------------------------------------------------------------
    -- PASO 5: Registrar en log de auditoría
    -- ------------------------------------------------------------------
    RAISE NOTICE '[5/5] Registrando en log de auditoría...';

    PERFORM public.registrar_log_cambio(
        NULL,                   -- sin usuario (proceso de sistema)
        v_municipio_id,
        'municipios',
        'INSERT',
        v_municipio_id::TEXT,
        NULL,
        jsonb_build_object(
            'codigo', v_codigo,
            'nombre', v_nombre,
            'esquema', v_municipio,
            'plan', v_plan
        ),
        'Onboarding de nuevo municipio: ' || v_nombre
    );

    RAISE NOTICE '[5/5] Log registrado';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Municipio "%" creado exitosamente.', v_nombre;
    RAISE NOTICE 'Esquema:   %', v_municipio;
    RAISE NOTICE 'ID:        %', v_municipio_id;
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'SIGUIENTE PASO: Ejecutar template_municipio.sql reemplazando';
    RAISE NOTICE '{municipio} por % para crear las tablas espaciales.', v_municipio;

EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'crear_municipio: conflicto de unicidad — el código, subdominio o esquema ya existen. Detalle: %', SQLERRM;

    WHEN insufficient_privilege THEN
        RAISE EXCEPTION 'crear_municipio: permisos insuficientes para crear esquema. Ejecutar como superusuario. Detalle: %', SQLERRM;

    WHEN OTHERS THEN
        -- Re-lanzar con contexto adicional para diagnóstico
        RAISE EXCEPTION 'crear_municipio: error durante el onboarding de "%" — %. SQLSTATE: %',
            v_nombre, SQLERRM, SQLSTATE;
END;
$onboarding$;

-- =============================================================================
-- INSTRUCCIONES POST-EJECUCIÓN
-- =============================================================================
\echo ''
\echo 'Onboarding completado. Para crear las tablas espaciales ejecutar:'
\echo ''
\echo '  sed "s/{municipio}/:municipio/g" database/spatial/template_municipio.sql | psql -U postgres -d sig_municipal'
\echo ''
\echo 'Y luego registrar el workspace en GeoServer (ver docs/geoserver_setup.md)'
