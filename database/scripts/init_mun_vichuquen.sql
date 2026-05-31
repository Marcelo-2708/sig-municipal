-- =============================================================================
-- init_mun_vichuquen.sql
-- Registra el municipio de Vichuquén y sus capas en las tablas públicas.
-- Idempotente: usa INSERT ... ON CONFLICT DO NOTHING.
-- Requiere que el schema mun_vichuquen y sus tablas ya existan en PostgreSQL.
-- =============================================================================

-- ── 1. Municipio ──────────────────────────────────────────────────────────────
INSERT INTO public.municipios (
    id,
    codigo,
    nombre,
    subdominio,
    region,
    provincia,
    esquema_bd,
    activo,
    plan
)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'vichuquen',
    'Municipalidad de Vichuquén',
    'vichuquen',
    'Maule',
    'Curicó',
    'mun_vichuquen',
    true,
    'basico'
)
ON CONFLICT (codigo) DO NOTHING;

-- ── 2. Capas ──────────────────────────────────────────────────────────────────
-- Usa el ID del municipio recién insertado (o el existente si ya había)

INSERT INTO public.capas (
    municipio_id,
    nombre_interno,
    nombre_visible,
    tipo,
    tabla_origen,
    url_wms,
    epsg,
    visible_por_defecto,
    orden,
    metadata,
    activo
)
VALUES

-- Manzanas censales (Censo INE 2017)
(
    '00000000-0000-0000-0000-000000000002',
    'censo',
    'Manzanas Censales',
    'wms',
    'censo',
    'http://sig_geoserver:8080/geoserver/vichuquen/wms',
    4326,
    true,
    1,
    '{
        "nombre_capa_wms": "vichuquen:censo",
        "descripcion": "Manzanas censales con atributos del Censo INE 2017",
        "categoria": "Censo",
        "fuente": "GeoServer local - workspace vichuquen",
        "fecha_actualizacion": "2026-05-28"
    }'::jsonb,
    true
),

-- Red vial
(
    '00000000-0000-0000-0000-000000000002',
    'red_vial',
    'Red Vial',
    'wms',
    'red_vial',
    'http://sig_geoserver:8080/geoserver/vichuquen/wms',
    4326,
    true,
    2,
    '{
        "nombre_capa_wms": "vichuquen:red_vial",
        "descripcion": "Red vial del municipio de Vichuquén",
        "categoria": "Infraestructura",
        "fuente": "GeoServer local - workspace vichuquen",
        "fecha_actualizacion": "2026-05-28"
    }'::jsonb,
    true
),

-- Amenaza
(
    '00000000-0000-0000-0000-000000000002',
    'amenaza',
    'Zonas de Amenaza',
    'wms',
    'amenaza',
    'http://sig_geoserver:8080/geoserver/vichuquen/wms',
    4326,
    false,
    3,
    '{
        "nombre_capa_wms": "vichuquen:amenaza",
        "descripcion": "Zonas de amenaza natural del municipio",
        "categoria": "Riesgo",
        "fuente": "GeoServer local - workspace vichuquen",
        "fecha_actualizacion": "2026-05-28"
    }'::jsonb,
    true
)

ON CONFLICT (municipio_id, nombre_interno) DO NOTHING;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT
    m.nombre        AS municipio,
    c.nombre_interno,
    c.nombre_visible,
    c.visible_por_defecto,
    c.metadata->>'nombre_capa_wms' AS capa_wms
FROM public.capas c
JOIN public.municipios m ON m.id = c.municipio_id
WHERE m.codigo = 'vichuquen'
ORDER BY c.orden;
