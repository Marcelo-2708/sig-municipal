/**
 * usuarioService.js — Lógica de negocio para gestión de usuarios en SIG Municipal.
 *
 * Columnas de public.usuarios:
 *   id, municipio_id, email, contrasena_hash, nombre, rol,
 *   activo, ultimo_acceso, creado_en, actualizado_en
 *
 * Roles válidos (migración 005):
 *   super_admin | admin_municipal | editor_gis | funcionario
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { consultar } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

const BCRYPT_ROUNDS = 12;

// Roles que un admin_municipal puede asignar (no puede crear super_admin)
export const ROLES_ASIGNABLES = ['admin_municipal', 'editor_gis', 'funcionario'];

// ── Listado ────────────────────────────────────────────────────────────────

/**
 * Lista los usuarios de un municipio con paginación y filtros opcionales.
 *
 * @param {string} municipioId
 * @param {{ pagina: number, limite: number, rol?: string, activo?: boolean }} opciones
 */
export async function obtenerUsuarios(municipioId, opciones = {}) {
  const { pagina = 1, limite = 20, rol, activo } = opciones;
  const offset = (pagina - 1) * limite;

  // Construir filtros dinámicos
  const condiciones = ['u.municipio_id = $1'];
  const params = [municipioId];
  let idx = 2;

  if (rol !== undefined) {
    condiciones.push(`u.rol = $${idx++}`);
    params.push(rol);
  }
  if (activo !== undefined) {
    condiciones.push(`u.activo = $${idx++}`);
    params.push(activo);
  }

  const where = condiciones.join(' AND ');

  const [resultadoUsuarios, resultadoTotal] = await Promise.all([
    consultar(
      `SELECT u.id, u.email, u.nombre, u.rol, u.activo,
              u.ultimo_acceso, u.creado_en, u.actualizado_en
       FROM public.usuarios u
       WHERE ${where}
       ORDER BY u.nombre ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limite, offset]
    ),
    consultar(
      `SELECT COUNT(*) AS total FROM public.usuarios u WHERE ${where}`,
      params
    ),
  ]);

  return {
    usuarios: resultadoUsuarios.rows,
    total: parseInt(resultadoTotal.rows[0].total, 10),
    pagina,
    limite,
  };
}

/**
 * Obtiene un usuario por ID verificando que pertenezca al tenant.
 *
 * @param {string} usuarioId
 * @param {string} municipioId
 */
export async function obtenerUsuario(usuarioId, municipioId) {
  const resultado = await consultar(
    `SELECT id, email, nombre, rol, activo, ultimo_acceso, creado_en, actualizado_en
     FROM public.usuarios
     WHERE id = $1 AND municipio_id = $2
     LIMIT 1`,
    [usuarioId, municipioId]
  );

  if (resultado.rows.length === 0) {
    throw new AppError('Usuario no encontrado', 404, 'USUARIO_NO_ENCONTRADO');
  }

  return resultado.rows[0];
}

// ── Creación ───────────────────────────────────────────────────────────────

/**
 * Crea un usuario en el municipio.
 * Genera contraseña hash con bcrypt. Retorna la contraseña en texto plano
 * solo en el momento de creación (para que el admin la comunique al usuario).
 *
 * @param {{ nombre: string, email: string, rol: string, contrasena?: string }} datos
 * @param {string} municipioId
 */
export async function crearUsuario(datos, municipioId) {
  const { nombre, email, rol, contrasena } = datos;

  // Verificar que el rol sea asignable
  if (!ROLES_ASIGNABLES.includes(rol)) {
    throw new AppError(
      `Rol no válido. Use uno de: ${ROLES_ASIGNABLES.join(', ')}`,
      422,
      'ROL_INVALIDO'
    );
  }

  // Verificar que el email no esté en uso
  const existente = await consultar(
    'SELECT id FROM public.usuarios WHERE email = $1 LIMIT 1',
    [email.toLowerCase().trim()]
  );
  if (existente.rows.length > 0) {
    throw new AppError('El email ya está registrado', 409, 'EMAIL_DUPLICADO');
  }

  // Usar contraseña provista o generar una temporal
  const contrasenaFinal = contrasena || _generarContrasenaTemp();
  const hash = await bcrypt.hash(contrasenaFinal, BCRYPT_ROUNDS);

  const resultado = await consultar(
    `INSERT INTO public.usuarios
       (municipio_id, email, contrasena_hash, nombre, rol, activo)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id, email, nombre, rol, activo, creado_en`,
    [municipioId, email.toLowerCase().trim(), hash, nombre.trim(), rol]
  );

  const usuarioCreado = resultado.rows[0];

  logger.info(
    { usuarioId: usuarioCreado.id, municipioId, rol, email },
    'Usuario creado exitosamente'
  );

  // Retornar la contraseña temporal solo en la creación
  return { ...usuarioCreado, contrasenaTemporal: contrasenaFinal };
}

// ── Actualización ──────────────────────────────────────────────────────────

/**
 * Actualiza nombre y/o rol de un usuario.
 * No permite cambiar el email ni el estado (usar toggleActivoUsuario para eso).
 *
 * @param {string} usuarioId
 * @param {string} municipioId
 * @param {{ nombre?: string, rol?: string }} cambios
 */
export async function actualizarUsuario(usuarioId, municipioId, cambios) {
  const usuario = await obtenerUsuario(usuarioId, municipioId);

  const { nombre = usuario.nombre, rol = usuario.rol } = cambios;

  if (rol && !ROLES_ASIGNABLES.includes(rol)) {
    throw new AppError(
      `Rol no válido. Use uno de: ${ROLES_ASIGNABLES.join(', ')}`,
      422,
      'ROL_INVALIDO'
    );
  }

  const resultado = await consultar(
    `UPDATE public.usuarios
     SET nombre = $1, rol = $2, actualizado_en = NOW()
     WHERE id = $3 AND municipio_id = $4
     RETURNING id, email, nombre, rol, activo, actualizado_en`,
    [nombre.trim(), rol, usuarioId, municipioId]
  );

  logger.info({ usuarioId, municipioId, cambios }, 'Usuario actualizado');

  return resultado.rows[0];
}

/**
 * Activa o desactiva un usuario (soft delete).
 * No se puede desactivar a sí mismo (verificación en la ruta).
 *
 * @param {string} usuarioId
 * @param {string} municipioId
 * @param {boolean} activo
 */
export async function toggleActivoUsuario(usuarioId, municipioId, activo) {
  await obtenerUsuario(usuarioId, municipioId);

  const resultado = await consultar(
    `UPDATE public.usuarios
     SET activo = $1, actualizado_en = NOW()
     WHERE id = $2 AND municipio_id = $3
     RETURNING id, email, nombre, rol, activo`,
    [activo, usuarioId, municipioId]
  );

  logger.info(
    { usuarioId, municipioId, activo },
    `Usuario ${activo ? 'activado' : 'desactivado'}`
  );

  return resultado.rows[0];
}

/**
 * Genera una nueva contraseña temporal para el usuario y la devuelve en texto plano.
 * El admin la comunica al usuario para que la cambie en su primer acceso.
 *
 * @param {string} usuarioId
 * @param {string} municipioId
 */
export async function resetearContrasena(usuarioId, municipioId) {
  await obtenerUsuario(usuarioId, municipioId);

  const contrasenaTemporal = _generarContrasenaTemp();
  const hash = await bcrypt.hash(contrasenaTemporal, BCRYPT_ROUNDS);

  await consultar(
    `UPDATE public.usuarios
     SET contrasena_hash = $1, actualizado_en = NOW()
     WHERE id = $2 AND municipio_id = $3`,
    [hash, usuarioId, municipioId]
  );

  logger.info({ usuarioId, municipioId }, 'Contraseña reseteada por administrador');

  return { contrasenaTemporal };
}

// ── Perfil propio ──────────────────────────────────────────────────────────

/**
 * Obtiene el perfil del usuario autenticado.
 *
 * @param {string} usuarioId - Del JWT (request.usuario.sub)
 */
export async function obtenerPerfil(usuarioId) {
  const resultado = await consultar(
    `SELECT u.id, u.email, u.nombre, u.rol, u.activo,
            u.ultimo_acceso, u.creado_en,
            m.nombre AS municipio_nombre, m.codigo AS municipio_codigo
     FROM public.usuarios u
     LEFT JOIN public.municipios m ON m.id = u.municipio_id
     WHERE u.id = $1
     LIMIT 1`,
    [usuarioId]
  );

  if (resultado.rows.length === 0) {
    throw new AppError('Usuario no encontrado', 404, 'USUARIO_NO_ENCONTRADO');
  }

  return resultado.rows[0];
}

/**
 * Actualiza el nombre del usuario autenticado (solo el propio nombre, no el rol).
 *
 * @param {string} usuarioId
 * @param {{ nombre: string }} datos
 */
export async function actualizarPerfil(usuarioId, datos) {
  const { nombre } = datos;

  const resultado = await consultar(
    `UPDATE public.usuarios
     SET nombre = $1, actualizado_en = NOW()
     WHERE id = $2
     RETURNING id, email, nombre, rol`,
    [nombre.trim(), usuarioId]
  );

  logger.info({ usuarioId }, 'Perfil actualizado por el propio usuario');

  return resultado.rows[0];
}

// ── Helper privado ─────────────────────────────────────────────────────────

function _generarContrasenaTemp() {
  // 12 caracteres alfanuméricos: fácil de comunicar, suficientemente aleatorio
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}
