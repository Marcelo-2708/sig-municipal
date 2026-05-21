/**
 * errorHandler.js — Handler global de errores para Fastify.
 *
 * Formatea todos los errores como:
 *   { error: string, codigo: string, statusCode: number }
 *
 * Loguea errores 5xx con stack trace completo.
 * Errores 4xx se loguean a nivel warn (sin stack trace) para no saturar los logs.
 */

import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Handler de errores compatible con Fastify setErrorHandler.
 *
 * @param {Error} error  - Error capturado
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export function errorHandler(error, request, reply) {
  // ── Errores de validación de Fastify (schema validation) ──────────────
  if (error.validation) {
    logger.warn(
      { ruta: request.url, metodo: request.method, errores: error.validation },
      'Error de validación en request'
    );
    return reply.status(422).send({
      error: 'Los datos enviados no son válidos',
      codigo: 'VALIDACION_FALLIDA',
      statusCode: 422,
      detalle: error.validation.map((v) => ({
        campo: v.instancePath || v.schemaPath,
        mensaje: v.message,
      })),
    });
  }

  // ── Errores de rate limit (@fastify/rate-limit) ────────────────────────
  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: error.message,
      codigo: 'RATE_LIMIT_EXCEDIDO',
      statusCode: 429,
    });
  }

  // ── AppError: errores de negocio controlados ──────────────────────────
  if (error instanceof AppError) {
    const nivel = error.codigoHttp >= 500 ? 'error' : 'warn';
    logger[nivel](
      {
        err: error,
        codigo: error.codigo,
        statusCode: error.codigoHttp,
        ruta: request.url,
        metodo: request.method,
        tenantId: request.tenant?.id,
        usuarioId: request.usuario?.sub,
      },
      `AppError: ${error.message}`
    );

    return reply.status(error.codigoHttp).send({
      error: error.message,
      codigo: error.codigo,
      statusCode: error.codigoHttp,
    });
  }

  // ── Errores JWT de @fastify/jwt ────────────────────────────────────────
  if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED' ||
      error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    return reply.status(401).send({
      error: 'Token de acceso inválido o expirado',
      codigo: 'TOKEN_INVALIDO',
      statusCode: 401,
    });
  }

  // ── Errores HTTP conocidos de Fastify ─────────────────────────────────
  if (error.statusCode && error.statusCode < 500) {
    logger.warn(
      {
        err: error,
        statusCode: error.statusCode,
        ruta: request.url,
        metodo: request.method,
      },
      `Error HTTP ${error.statusCode}: ${error.message}`
    );
    return reply.status(error.statusCode).send({
      error: error.message,
      codigo: error.code ?? 'ERROR_HTTP',
      statusCode: error.statusCode,
    });
  }

  // ── Error inesperado del sistema ──────────────────────────────────────
  // Loguear con stack trace completo para diagnóstico
  logger.error(
    {
      err: error,
      stack: error.stack,
      ruta: request.url,
      metodo: request.method,
      tenantId: request.tenant?.id,
      usuarioId: request.usuario?.sub,
    },
    `Error inesperado del servidor: ${error.message}`
  );

  // En producción no exponer detalles internos al cliente
  const mensajeCliente =
    process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : error.message;

  return reply.status(500).send({
    error: mensajeCliente,
    codigo: 'ERROR_INTERNO',
    statusCode: 500,
  });
}
