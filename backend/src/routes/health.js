/**
 * health.js — Endpoint de salud para SIG Municipal.
 *
 * GET /health — Sin autenticación, sin tenant.
 * Usado por Docker healthcheck, load balancers y monitoreo.
 */

import { verificarConexion } from '../config/database.js';

const VERSION = process.env.npm_package_version ?? '1.0.0';

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function rutasHealth(fastify) {
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Verificación de salud del servidor',
        tags: ['Sistema'],
        response: {
          200: {
            type: 'object',
            properties: {
              estado: { type: 'string' },
              version: { type: 'string' },
              timestamp: { type: 'string' },
              baseDatos: { type: 'string' },
            },
          },
        },
      },
      // Excluir del rate limit general
      config: { rateLimit: false },
    },
    async (_request, _reply) => {
      const bdOk = await verificarConexion();

      return {
        estado: 'ok',
        version: VERSION,
        timestamp: new Date().toISOString(),
        baseDatos: bdOk ? 'conectada' : 'sin_conexion',
      };
    }
  );
}
