-- =============================================================================
-- Script: reemplazar_capas_demo.sql
-- Elimina las 3 capas demo y agrega 2 capas WMS externas de QGIS Cloud.
-- Ejecutar solo en el municipio demo (desarrollo).
-- =============================================================================

BEGIN;

-- Eliminar capas demo del municipio demo
DELETE FROM public.capas
WHERE municipio_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- Capa 1: INACAP Concepción-Talcahuano
INSERT INTO public.capas (
    municipio_id,
    nombre_interno,
    nombre_visible,
    tipo,
    tabla_origen,
    url_wms,
    url_wfs,
    estilo_sld,
    visible_por_defecto,
    activo,
    orden,
    metadata
)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'inacap_ccp_thno',
    'INACAP Concepción-Talcahuano',
    'wms',
    NULL,
    'https://qgiscloud.com/jabcist/ProyectoSIG_/wms',
    NULL,
    NULL,
    TRUE,
    TRUE,
    1,
    '{
        "descripcion": "Establecimientos INACAP en la región de Concepción-Talcahuano",
        "categoria": "Educación",
        "fuente": "QGIS Cloud — jabcist/ProyectoSIG_",
        "nombre_capa_wms": "INACAP_Ccp-Thno",
        "fecha_actualizacion": "2026-05-22"
    }'::jsonb
);

-- Capa 2: EEM Idóneos
INSERT INTO public.capas (
    municipio_id,
    nombre_interno,
    nombre_visible,
    tipo,
    tabla_origen,
    url_wms,
    url_wfs,
    estilo_sld,
    visible_por_defecto,
    activo,
    orden,
    metadata
)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'eem_idoneos',
    'EEM Idóneos',
    'wms',
    NULL,
    'https://qgiscloud.com/jabcist/ProyectoSIG_/wms',
    NULL,
    NULL,
    TRUE,
    TRUE,
    2,
    '{
        "descripcion": "Establecimientos Educacionales Municipales idóneos",
        "categoria": "Educación",
        "fuente": "QGIS Cloud — jabcist/ProyectoSIG_",
        "nombre_capa_wms": "EEM_idoneos",
        "fecha_actualizacion": "2026-05-22"
    }'::jsonb
);

COMMIT;
