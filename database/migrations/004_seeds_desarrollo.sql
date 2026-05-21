-- =============================================================================
-- MIGRACIÓN 004: Seeds de desarrollo
-- Proyecto: SIG Municipal — Plataforma WebGIS Multi-tenant
-- Fecha: 2026-05-01
-- =============================================================================
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ADVERTENCIA: SOLO PARA DESARROLLO — NO EJECUTAR EN PRODUCCIÓN          ║
-- ║                                                                          ║
-- ║  Este archivo contiene datos de prueba con credenciales conocidas.       ║
-- ║  Ejecutar únicamente en entornos de desarrollo/CI.                       ║
-- ║  Verificar que DATABASE_ENV=development antes de ejecutar.               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- =============================================================================

BEGIN;

-- Verificación de seguridad: abortar si parece ser un entorno de producción
DO $$
BEGIN
    -- Advertencia explícita en el log de PostgreSQL
    RAISE WARNING '========================================================';
    RAISE WARNING 'SEEDS DE DESARROLLO — Insertando datos de prueba';
    RAISE WARNING 'NO ejecutar en producción. Solo para desarrollo/CI.';
    RAISE WARNING '========================================================';
END
$$;

-- =============================================================================
-- MUNICIPIO DEMO
-- Tenant piloto para desarrollo y pruebas de integración
-- =============================================================================
INSERT INTO public.municipios (
    id,
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
    '00000000-0000-0000-0000-000000000001'::UUID,
    'demo',
    'Municipalidad Demo',
    'demo',
    'Región del Biobío',
    'Concepción',
    'mun_demo',
    TRUE,
    'premium',
    '{
        "logo_url": "/assets/logos/demo.png",
        "color_primario": "#1a5276",
        "color_secundario": "#2e86c1",
        "capas_visibles_por_defecto": ["predios", "plano_regulador"],
        "centro_mapa": { "lat": -36.8269882, "lon": -73.0497600, "zoom": 13 },
        "descripcion": "Municipio de demostración para pruebas de la plataforma"
    }'::jsonb
)
ON CONFLICT (codigo) DO UPDATE SET
    nombre          = EXCLUDED.nombre,
    config          = EXCLUDED.config,
    actualizado_en  = NOW();

-- =============================================================================
-- USUARIO SUPER ADMINISTRADOR
-- Credenciales de desarrollo SOLAMENTE — bcrypt de 'admin123' (12 rounds)
-- NUNCA usar estas credenciales en producción
-- =============================================================================
INSERT INTO public.usuarios (
    id,
    municipio_id,
    email,
    password_hash,
    nombre,
    rol,
    activo
)
VALUES (
    '00000000-0000-0000-0000-000000000010'::UUID,
    NULL,   -- super_admin no pertenece a un municipio específico
    'admin@sig.cl',
    -- Hash bcrypt de 'admin123' con 12 rounds — SOLO DESARROLLO
    -- Regenerar con: node -e "require('bcrypt').hash('admin123',12).then(console.log)"
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/ywKyR.8K2qZ5Ww4Aq',
    'Super Admin (Desarrollo)',
    'super_admin',
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    password_hash  = EXCLUDED.password_hash,
    nombre         = EXCLUDED.nombre,
    actualizado_en = NOW();

-- Usuario administrador del municipio demo
INSERT INTO public.usuarios (
    id,
    municipio_id,
    email,
    password_hash,
    nombre,
    rol,
    activo
)
VALUES (
    '00000000-0000-0000-0000-000000000011'::UUID,
    '00000000-0000-0000-0000-000000000001'::UUID,
    'municipio@demo.sig.cl',
    -- Hash bcrypt de 'demo1234' con 12 rounds — SOLO DESARROLLO
    '$2b$12$Kix1RoiZH4hFAYnMp3GkTuXJqT7Wl9kCa1vDhHF4PxOzWm3sEuY5i',
    'Administrador Demo',
    'admin_municipio',
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    password_hash  = EXCLUDED.password_hash,
    nombre         = EXCLUDED.nombre,
    actualizado_en = NOW();

-- Usuario editor del municipio demo
INSERT INTO public.usuarios (
    id,
    municipio_id,
    email,
    password_hash,
    nombre,
    rol,
    activo
)
VALUES (
    '00000000-0000-0000-0000-000000000012'::UUID,
    '00000000-0000-0000-0000-000000000001'::UUID,
    'editor@demo.sig.cl',
    -- Hash bcrypt de 'editor123' con 12 rounds — SOLO DESARROLLO
    '$2b$12$8NkLmP3vRoaIqXjW7hEcKuFsY2nGdT9bC5wAoH6xDqV4pJ1tMeU8r',
    'Editor Demo',
    'editor',
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    password_hash  = EXCLUDED.password_hash,
    nombre         = EXCLUDED.nombre,
    actualizado_en = NOW();

-- =============================================================================
-- CAPAS DE EJEMPLO PARA EL MUNICIPIO DEMO
-- =============================================================================

-- Capa 1: Predios del catastro municipal
INSERT INTO public.capas (
    id,
    municipio_id,
    nombre_interno,
    nombre_visible,
    tipo,
    tabla_origen,
    url_wms,
    url_wfs,
    estilo_sld,
    bbox_minx,
    bbox_miny,
    bbox_maxx,
    bbox_maxy,
    epsg,
    visible_por_defecto,
    orden,
    metadata
)
VALUES (
    '00000000-0000-0000-0000-000000000100'::UUID,
    '00000000-0000-0000-0000-000000000001'::UUID,
    'predios',
    'Predios Catastro',
    'wms',
    'predios',
    'http://geoserver:8080/geoserver/mun_demo/wms',
    'http://geoserver:8080/geoserver/mun_demo/wfs',
    'predios_default',
    -73.1200, -36.9000, -72.9800, -36.7500,
    4326,
    TRUE,
    1,
    '{
        "descripcion": "Catastro predial del municipio — polígonos con rol SII, dirección y propietario",
        "fuente": "Servicio de Impuestos Internos (SII)",
        "fecha_actualizacion": "2026-01-01",
        "atributos_visibles": ["rol_sii", "direccion", "propietario", "uso_suelo"]
    }'::jsonb
)
ON CONFLICT (municipio_id, nombre_interno) DO UPDATE SET
    nombre_visible = EXCLUDED.nombre_visible,
    metadata       = EXCLUDED.metadata,
    actualizado_en = NOW();

-- Capa 2: Plano regulador comunal
INSERT INTO public.capas (
    id,
    municipio_id,
    nombre_interno,
    nombre_visible,
    tipo,
    tabla_origen,
    url_wms,
    url_wfs,
    estilo_sld,
    bbox_minx,
    bbox_miny,
    bbox_maxx,
    bbox_maxy,
    epsg,
    visible_por_defecto,
    orden,
    metadata
)
VALUES (
    '00000000-0000-0000-0000-000000000101'::UUID,
    '00000000-0000-0000-0000-000000000001'::UUID,
    'plano_regulador',
    'Plano Regulador Comunal',
    'wms',
    'plano_regulador',
    'http://geoserver:8080/geoserver/mun_demo/wms',
    'http://geoserver:8080/geoserver/mun_demo/wfs',
    'plano_regulador_colores',
    -73.1200, -36.9000, -72.9800, -36.7500,
    4326,
    TRUE,
    2,
    '{
        "descripcion": "Zonificación del Plan Regulador Comunal (PRC) vigente",
        "fuente": "Municipalidad Demo — Dirección de Obras",
        "fecha_actualizacion": "2025-06-15",
        "atributos_visibles": ["codigo_zona", "nombre_zona", "uso_permitido", "altura_maxima_m"]
    }'::jsonb
)
ON CONFLICT (municipio_id, nombre_interno) DO UPDATE SET
    nombre_visible = EXCLUDED.nombre_visible,
    metadata       = EXCLUDED.metadata,
    actualizado_en = NOW();

-- Capa 3: Alumbrado público
INSERT INTO public.capas (
    id,
    municipio_id,
    nombre_interno,
    nombre_visible,
    tipo,
    tabla_origen,
    url_wms,
    url_wfs,
    estilo_sld,
    bbox_minx,
    bbox_miny,
    bbox_maxx,
    bbox_maxy,
    epsg,
    visible_por_defecto,
    orden,
    metadata
)
VALUES (
    '00000000-0000-0000-0000-000000000102'::UUID,
    '00000000-0000-0000-0000-000000000001'::UUID,
    'alumbrado',
    'Alumbrado Público',
    'wms',
    'alumbrado',
    'http://geoserver:8080/geoserver/mun_demo/wms',
    NULL,   -- sin WFS (solo consulta visual)
    'alumbrado_puntos',
    -73.1200, -36.9000, -72.9800, -36.7500,
    4326,
    FALSE,
    3,
    '{
        "descripcion": "Puntos de luminaria del alumbrado público comunal",
        "fuente": "Municipalidad Demo — Dirección de Servicios",
        "fecha_actualizacion": "2025-12-01",
        "atributos_visibles": ["tipo_luminaria", "potencia_w", "estado", "fecha_instalacion"]
    }'::jsonb
)
ON CONFLICT (municipio_id, nombre_interno) DO UPDATE SET
    nombre_visible = EXCLUDED.nombre_visible,
    metadata       = EXCLUDED.metadata,
    actualizado_en = NOW();

-- =============================================================================
-- REPORTE CIUDADANO DE EJEMPLO
-- =============================================================================
INSERT INTO public.reportes_ciudadanos (
    id,
    municipio_id,
    categoria,
    descripcion,
    ubicacion,
    direccion_aprox,
    nombre_contacto,
    email_contacto,
    estado,
    prioridad
)
VALUES (
    '00000000-0000-0000-0000-000000000200'::UUID,
    '00000000-0000-0000-0000-000000000001'::UUID,
    'luminaria',
    'Luminaria apagada hace más de una semana en la esquina, representa un riesgo para los peatones en horario nocturno.',
    ST_SetSRID(ST_MakePoint(-73.0497, -36.8270), 4326),
    'Av. Los Carrera con Calle Tucapel, Demo',
    'Juan Ciudadano (Demo)',
    'ciudadano@ejemplo.cl',
    'pendiente',
    2
)
ON CONFLICT (id) DO NOTHING;

-- Registrar en log de auditoría
INSERT INTO public.log_cambios (
    usuario_id,
    municipio_id,
    tabla_afectada,
    operacion,
    descripcion
)
VALUES (
    '00000000-0000-0000-0000-000000000010'::UUID,
    '00000000-0000-0000-0000-000000000001'::UUID,
    'seeds_desarrollo',
    'INSERT',
    'Seeds de desarrollo ejecutados — municipio demo, usuarios de prueba y capas de ejemplo creados'
);

COMMIT;

-- =============================================================================
-- ROLLBACK
-- Para revertir esta migración ejecutar el bloque siguiente:
-- ADVERTENCIA: Eliminará todos los datos de desarrollo insertados
-- =============================================================================
/*
BEGIN;

DELETE FROM public.log_cambios      WHERE municipio_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.reportes_ciudadanos WHERE municipio_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.capas            WHERE municipio_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.usuarios         WHERE id IN (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000012'
);
DELETE FROM public.municipios       WHERE codigo = 'demo';

COMMIT;
*/
