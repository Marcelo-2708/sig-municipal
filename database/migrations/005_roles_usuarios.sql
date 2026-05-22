-- =============================================================================
-- MIGRACIÓN 005: Alinear roles de usuarios y corregir nombre de columna
-- Proyecto: SIG Municipal
-- Fecha: 2026-05-21
--
-- Problema detectado en 2.1:
--   (a) La tabla public.usuarios define roles distintos a los que usa el
--       middleware de autenticación (auth.js). La BD tiene:
--         'super_admin', 'admin_municipio', 'editor', 'visor'
--       El middleware espera (jerarquía real del sistema):
--         'super_admin', 'admin_municipal', 'editor_gis', 'funcionario'
--
--   (b) La migración 001 declaró la columna como "password_hash" pero
--       authService.js la consulta como "contrasena_hash". Esta migración
--       la renombra para que el código existente funcione correctamente.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- (a) Renombrar columna password_hash → contrasena_hash
--     Solo si todavía se llama password_hash (idempotente)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'usuarios'
          AND column_name  = 'contrasena_hash'
    ) THEN
        ALTER TABLE public.usuarios RENAME COLUMN password_hash TO contrasena_hash;
        RAISE NOTICE 'Columna renombrada: password_hash → contrasena_hash';
    ELSE
        RAISE NOTICE 'Columna ya se llama contrasena_hash — sin cambios necesarios';
    END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- (b) Actualizar datos existentes antes de cambiar el CHECK constraint
-- -----------------------------------------------------------------------------
UPDATE public.usuarios SET rol = 'admin_municipal' WHERE rol = 'admin_municipio';
UPDATE public.usuarios SET rol = 'editor_gis'      WHERE rol = 'editor';
UPDATE public.usuarios SET rol = 'funcionario'     WHERE rol = 'visor';

-- -----------------------------------------------------------------------------
-- (c) Reemplazar CHECK constraint con los roles correctos del middleware
-- -----------------------------------------------------------------------------
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;

ALTER TABLE public.usuarios
    ADD CONSTRAINT usuarios_rol_check
    CHECK (rol IN ('super_admin', 'admin_municipal', 'editor_gis', 'funcionario'));

COMMENT ON COLUMN public.usuarios.rol IS
    'Rol del usuario en el sistema: super_admin (plataforma completa) | admin_municipal (su municipio) | editor_gis (capas) | funcionario (solo lectura)';

-- -----------------------------------------------------------------------------
-- Registro en log de auditoría
-- -----------------------------------------------------------------------------
INSERT INTO public.log_cambios (
    municipio_id, tabla_afectada, operacion, descripcion
)
VALUES (
    NULL,
    'public.usuarios',
    'UPDATE',
    'Migración 005: roles alineados con middleware auth (admin_municipio→admin_municipal, editor→editor_gis, visor→funcionario); columna renombrada password_hash→contrasena_hash'
);

COMMIT;
