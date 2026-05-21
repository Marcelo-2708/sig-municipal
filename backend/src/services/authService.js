/**
 * authService.js — Lógica de negocio de autenticación para SIG Municipal.
 *
 * Responsabilidades:
 *   - Verificar credenciales de usuario con bcrypt
 *   - Generar access token (JWT, 15 min) y refresh token (JWT, 7d)
 *   - Almacenar hash del refresh token en BD
 *   - Revocar refresh tokens
 *   - Rotar refresh tokens en cada uso
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { consultar, transaccion } from '../config/database.js';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Verifica las credenciales del usuario y retorna tokens de acceso.
 *
 * @param {string} email
 * @param {string} password
 * @param {object} fastify - Instancia de Fastify (para jwt.sign)
 * @returns {Promise<{accessToken: string, refreshToken: string, usuario: object}>}
 */
export async function login(email, password, fastify) {
  logger.info({ email }, 'Intento de login');

  // Buscar usuario por email en public.usuarios (sin filtrar por tenant en login)
  const resultadoUsuario = await consultar(
    `SELECT u.id, u.email, u.nombre, u.contrasena_hash, u.rol, u.activo,
            u.municipio_id, m.codigo AS municipio_codigo, m.esquema_bd
     FROM public.usuarios u
     LEFT JOIN public.municipios m ON m.id = u.municipio_id
     WHERE u.email = $1
     LIMIT 1`,
    [email.toLowerCase().trim()]
  );

  if (resultadoUsuario.rows.length === 0) {
    // No revelar si el email existe (prevenir enumeración de usuarios)
    logger.warn({ email }, 'Login fallido: email no encontrado');
    throw new AppError('Email o contraseña incorrectos', 401, 'CREDENCIALES_INVALIDAS');
  }

  const usuario = resultadoUsuario.rows[0];

  // Verificar que el usuario esté activo
  if (!usuario.activo) {
    logger.warn({ email, usuarioId: usuario.id }, 'Login fallido: usuario inactivo');
    throw new AppError('Usuario inactivo. Contacta al administrador.', 403, 'USUARIO_INACTIVO');
  }

  // Verificar contraseña con bcrypt
  const contrasenaValida = await bcrypt.compare(password, usuario.contrasena_hash);
  if (!contrasenaValida) {
    logger.warn({ email, usuarioId: usuario.id }, 'Login fallido: contraseña incorrecta');
    throw new AppError('Email o contraseña incorrectos', 401, 'CREDENCIALES_INVALIDAS');
  }

  // Generar tokens
  const { accessToken, refreshToken, refreshTokenHash } = await generarTokens(usuario, fastify);

  // Guardar hash del refresh token en BD
  await guardarRefreshToken(usuario.id, refreshTokenHash);

  logger.info({ usuarioId: usuario.id, email, rol: usuario.rol }, 'Login exitoso');

  return {
    accessToken,
    refreshToken,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      municipioId: usuario.municipio_id,
      municipioCodigo: usuario.municipio_codigo,
    },
  };
}

/**
 * Intercambia un refresh token válido por un nuevo par de tokens.
 * Implementa rotación: el refresh token anterior se revoca.
 *
 * @param {string} refreshTokenActual - Refresh token enviado por el cliente
 * @param {object} fastify
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
export async function refrescarTokens(refreshTokenActual, fastify) {
  // Verificar firma del refresh token
  let payload;
  try {
    payload = fastify.jwt.verify(refreshTokenActual);
  } catch (error) {
    logger.warn('Refresh token inválido o expirado');
    throw new AppError('Refresh token inválido o expirado', 401, 'REFRESH_TOKEN_INVALIDO');
  }

  // Calcular hash del token recibido para comparar con BD
  const tokenHash = hashearToken(refreshTokenActual);

  // Buscar el token en BD y verificar que no esté revocado
  const resultado = await consultar(
    `SELECT rt.id, rt.revocado, rt.expira_en, u.id AS usuario_id, u.email,
            u.nombre, u.rol, u.activo, u.municipio_id
     FROM public.refresh_tokens rt
     JOIN public.usuarios u ON u.id = rt.usuario_id
     WHERE rt.token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  if (resultado.rows.length === 0) {
    logger.warn('Refresh token no encontrado en BD');
    throw new AppError('Refresh token inválido', 401, 'REFRESH_TOKEN_INVALIDO');
  }

  const registro = resultado.rows[0];

  if (registro.revocado) {
    // Posible reutilización de token robado — revocar todos los tokens del usuario
    logger.warn({ usuarioId: registro.usuario_id }, 'Reutilización detectada de refresh token revocado. Revocando todos los tokens.');
    await revocarTodosLosTokens(registro.usuario_id);
    throw new AppError('Refresh token ya fue utilizado', 401, 'REFRESH_TOKEN_REVOCADO');
  }

  if (new Date(registro.expira_en) < new Date()) {
    throw new AppError('Refresh token expirado', 401, 'REFRESH_TOKEN_EXPIRADO');
  }

  if (!registro.activo) {
    throw new AppError('Usuario inactivo', 403, 'USUARIO_INACTIVO');
  }

  const usuario = {
    id: registro.usuario_id,
    email: registro.email,
    nombre: registro.nombre,
    rol: registro.rol,
    municipio_id: registro.municipio_id,
  };

  // Generar nuevos tokens y revocar el anterior (rotación)
  const { accessToken, refreshToken, refreshTokenHash } = await generarTokens(usuario, fastify);

  await transaccion(async (cliente) => {
    // Revocar token anterior
    await cliente.query(
      'UPDATE public.refresh_tokens SET revocado = true WHERE id = $1',
      [registro.id]
    );
    // Insertar nuevo refresh token
    const expira = calcularExpiracion(config.jwt.refreshExpira);
    await cliente.query(
      `INSERT INTO public.refresh_tokens (usuario_id, token_hash, expira_en)
       VALUES ($1, $2, $3)`,
      [usuario.id, refreshTokenHash, expira]
    );
  });

  logger.info({ usuarioId: usuario.id }, 'Refresh token rotado exitosamente');

  return { accessToken, refreshToken };
}

/**
 * Revoca un refresh token específico (logout).
 *
 * @param {string} refreshToken - Token a revocar
 */
export async function logout(refreshToken) {
  const tokenHash = hashearToken(refreshToken);

  const resultado = await consultar(
    'UPDATE public.refresh_tokens SET revocado = true WHERE token_hash = $1 AND revocado = false',
    [tokenHash]
  );

  if (resultado.rowCount === 0) {
    logger.warn('Intento de logout con token no encontrado o ya revocado');
    // No lanzar error — el resultado es el mismo (sesión cerrada)
  } else {
    logger.info('Refresh token revocado exitosamente (logout)');
  }
}

// ── Funciones auxiliares ───────────────────────────────────────────────────

/**
 * Genera access token y refresh token firmados con JWT.
 */
async function generarTokens(usuario, fastify) {
  const payload = {
    sub: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    tenantId: usuario.municipio_id,
  };

  const accessToken = fastify.jwt.sign(payload, { expiresIn: config.jwt.accessExpira });
  const refreshToken = fastify.jwt.sign(
    { sub: usuario.id, tipo: 'refresh' },
    { expiresIn: config.jwt.refreshExpira }
  );

  const refreshTokenHash = hashearToken(refreshToken);

  return { accessToken, refreshToken, refreshTokenHash };
}

/**
 * Almacena el hash del refresh token en la tabla public.refresh_tokens.
 */
async function guardarRefreshToken(usuarioId, tokenHash) {
  const expira = calcularExpiracion(config.jwt.refreshExpira);
  await consultar(
    `INSERT INTO public.refresh_tokens (usuario_id, token_hash, expira_en)
     VALUES ($1, $2, $3)`,
    [usuarioId, tokenHash, expira]
  );
}

/**
 * Revoca todos los refresh tokens de un usuario (medida de seguridad).
 */
async function revocarTodosLosTokens(usuarioId) {
  await consultar(
    'UPDATE public.refresh_tokens SET revocado = true WHERE usuario_id = $1 AND revocado = false',
    [usuarioId]
  );
}

/**
 * Calcula la fecha de expiración a partir de una cadena como "7d", "15m", "1h".
 */
function calcularExpiracion(expira) {
  const unidades = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = expira.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Formato de expiración inválido: ${expira}`);
  const [, cantidad, unidad] = match;
  return new Date(Date.now() + parseInt(cantidad, 10) * unidades[unidad]);
}

/**
 * Genera un hash SHA-256 del token para almacenarlo en BD (nunca el token en claro).
 */
function hashearToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
