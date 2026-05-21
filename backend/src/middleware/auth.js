/**
 * auth.js — Middleware de autenticación y autorización JWT para SIG Municipal.
 *
 * verificarToken: verifica el JWT del header Authorization: Bearer <token>
 *                 y adjunta el payload a request.usuario.
 *
 * soloRoles(...roles): factory que retorna un hook de autorización que verifica
 *                      que el usuario autenticado tenga uno de los roles indicados.
 *
 * Jerarquía de roles (de menor a mayor):
 *   ciudadano < funcionario < editor_gis < admin_municipal < super_admin
 */

import logger from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

// Jerarquía de roles para comparación
const JERARQUIA_ROLES = {
  ciudadano: 0,
  funcionario: 1,
  editor_gis: 2,
  admin_municipal: 3,
  super_admin: 4,
};

/**
 * Hook de Fastify que verifica el JWT del header Authorization.
 * El plugin @fastify/jwt debe estar registrado antes de usar este hook.
 *
 * Adjunta a request.usuario el payload decodificado:
 *   { sub: usuarioId, rol, tenantId }
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function verificarToken(request, reply) {
  try {
    // jwtVerify es inyectado por @fastify/jwt
    await request.jwtVerify();
    // El payload queda en request.user (nombre de @fastify/jwt)
    // Lo renombramos a request.usuario para seguir convención en español
    request.usuario = request.user;

    logger.debug(
      { usuarioId: request.usuario.sub, rol: request.usuario.rol },
      'Token JWT verificado correctamente'
    );
  } catch (error) {
    logger.warn({ err: error }, 'Token JWT inválido o expirado');
    return reply.status(401).send({
      error: 'Token de acceso inválido o expirado',
      codigo: 'TOKEN_INVALIDO',
      statusCode: 401,
    });
  }
}

/**
 * Factory de hooks de autorización por rol.
 *
 * Retorna un hook de Fastify que verifica que el usuario autenticado
 * tenga al menos uno de los roles indicados. También acepta roles de
 * jerarquía superior (ej: soloRoles('editor_gis') permite a admin_municipal).
 *
 * @param {...string} rolesPermitidos - Roles mínimos requeridos
 * @returns {Function} Hook de Fastify preHandler
 *
 * @example
 * fastify.get('/admin', { preHandler: [verificarToken, soloRoles('funcionario')] }, handler)
 */
export function soloRoles(...rolesPermitidos) {
  return async function verificarRol(request, reply) {
    // Requiere que verificarToken se haya ejecutado antes
    if (!request.usuario) {
      return reply.status(401).send({
        error: 'Autenticación requerida',
        codigo: 'NO_AUTENTICADO',
        statusCode: 401,
      });
    }

    const rolUsuario = request.usuario.rol;
    const nivelUsuario = JERARQUIA_ROLES[rolUsuario] ?? -1;

    // Verificar si el usuario tiene al menos uno de los roles requeridos
    // o un rol de jerarquía superior
    const nivelMinimoRequerido = Math.min(
      ...rolesPermitidos.map((r) => JERARQUIA_ROLES[r] ?? Infinity)
    );

    if (nivelUsuario < nivelMinimoRequerido) {
      logger.warn(
        {
          usuarioId: request.usuario.sub,
          rolUsuario,
          rolesRequeridos: rolesPermitidos,
        },
        'Acceso denegado por rol insuficiente'
      );
      return reply.status(403).send({
        error: 'No tienes permiso para realizar esta acción',
        codigo: 'SIN_PERMISO',
        statusCode: 403,
      });
    }

    // Para rutas no super_admin, verificar que el usuario pertenezca al tenant correcto
    // (a menos que sea super_admin, que puede acceder a todos)
    if (rolUsuario !== 'super_admin' && request.tenant) {
      if (request.usuario.tenantId !== request.tenant.id) {
        logger.warn(
          {
            usuarioId: request.usuario.sub,
            tenantIdToken: request.usuario.tenantId,
            tenantIdRequest: request.tenant.id,
          },
          'Intento de acceso a tenant ajeno'
        );
        return reply.status(403).send({
          error: 'Acceso no autorizado a este municipio',
          codigo: 'TENANT_NO_AUTORIZADO',
          statusCode: 403,
        });
      }
    }

    logger.debug(
      { usuarioId: request.usuario.sub, rol: rolUsuario },
      'Autorización por rol exitosa'
    );
  };
}
