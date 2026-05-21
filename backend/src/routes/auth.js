/**
 * auth.js — Rutas de autenticación para SIG Municipal.
 *
 * POST /api/auth/login    — Login con email y password
 * POST /api/auth/logout   — Revoca refresh token
 * POST /api/auth/refresh  — Renueva access token usando refresh token
 * GET  /api/auth/me       — Datos del usuario autenticado
 */

import { verificarToken } from '../middleware/auth.js';
import { rateLimitAuth } from '../middleware/rateLimit.js';
import { login, logout, refrescarTokens } from '../services/authService.js';
import { consultar } from '../config/database.js';
import { zLogin, validar } from '../utils/validators.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function rutasAuth(fastify) {
  // ── POST /api/auth/login ──────────────────────────────────────────────
  fastify.post(
    '/api/auth/login',
    {
      config: rateLimitAuth,
      schema: {
        description: 'Autenticar usuario con email y contraseña',
        tags: ['Autenticación'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              usuario: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  nombre: { type: 'string' },
                  rol: { type: 'string' },
                  municipioId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const datos = await validar(zLogin, request.body);
      const resultado = await login(datos.email, datos.password, fastify);
      return reply.status(200).send(resultado);
    }
  );

  // ── POST /api/auth/logout ─────────────────────────────────────────────
  fastify.post(
    '/api/auth/logout',
    {
      schema: {
        description: 'Cerrar sesión y revocar refresh token',
        tags: ['Autenticación'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;
      if (!refreshToken) {
        throw new AppError('El refreshToken es requerido', 400, 'REFRESH_TOKEN_REQUERIDO');
      }

      await logout(refreshToken);

      logger.info({ ip: request.ip }, 'Logout exitoso');
      return reply.status(200).send({ mensaje: 'Sesión cerrada correctamente' });
    }
  );

  // ── POST /api/auth/refresh ────────────────────────────────────────────
  fastify.post(
    '/api/auth/refresh',
    {
      config: rateLimitAuth,
      schema: {
        description: 'Renovar access token usando refresh token',
        tags: ['Autenticación'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;
      if (!refreshToken) {
        throw new AppError('El refreshToken es requerido', 400, 'REFRESH_TOKEN_REQUERIDO');
      }

      const tokens = await refrescarTokens(refreshToken, fastify);
      return reply.status(200).send(tokens);
    }
  );

  // ── GET /api/auth/me ──────────────────────────────────────────────────
  fastify.get(
    '/api/auth/me',
    {
      preHandler: [verificarToken],
      schema: {
        description: 'Obtener datos del usuario autenticado',
        tags: ['Autenticación'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              nombre: { type: 'string' },
              rol: { type: 'string' },
              municipioId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const usuarioId = request.usuario.sub;

      const resultado = await consultar(
        `SELECT id, email, nombre, rol, municipio_id AS "municipioId", activo
         FROM public.usuarios
         WHERE id = $1`,
        [usuarioId]
      );

      if (resultado.rows.length === 0) {
        throw new AppError('Usuario no encontrado', 404, 'USUARIO_NO_ENCONTRADO');
      }

      const usuario = resultado.rows[0];
      if (!usuario.activo) {
        throw new AppError('Usuario inactivo', 403, 'USUARIO_INACTIVO');
      }

      return reply.status(200).send(usuario);
    }
  );
}
