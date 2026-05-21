/**
 * predios.js — Rutas de búsqueda y consulta predial para SIG Municipal.
 *
 * GET /api/predios/buscar?q=texto — Búsqueda textual (sin auth, mínimo 3 chars)
 * GET /api/predios/:rol           — Ficha pública de un predio por rol SII
 */

import { buscarPredios, obtenerFichaPredio } from '../services/predioService.js';
import { AppError } from '../utils/AppError.js';

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function rutasPredios(fastify) {
  // ── GET /api/predios/buscar ───────────────────────────────────────────
  fastify.get(
    '/api/predios/buscar',
    {
      schema: {
        description: 'Busca predios por texto (dirección, rol SII, nombre)',
        tags: ['Predios'],
        querystring: {
          type: 'object',
          required: ['q'],
          properties: {
            q: { type: 'string', minLength: 3 },
            limite: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                rol_sii: { type: 'string' },
                direccion: { type: 'string' },
                uso_suelo: { type: 'string' },
                latitud: { type: 'number' },
                longitud: { type: 'number' },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { q, limite = 10 } = request.query;

      if (!q || q.trim().length < 3) {
        throw new AppError('La búsqueda debe tener al menos 3 caracteres', 400, 'BUSQUEDA_MUY_CORTA');
      }

      const predios = await buscarPredios(request.tenant.esquemaBd, q.trim(), parseInt(limite, 10));
      return reply.status(200).send(predios);
    }
  );

  // ── GET /api/predios/:rol ─────────────────────────────────────────────
  fastify.get(
    '/api/predios/:rol',
    {
      schema: {
        description: 'Obtiene la ficha pública de un predio por su rol SII',
        tags: ['Predios'],
        params: {
          type: 'object',
          required: ['rol'],
          properties: {
            // Formato rol SII chileno: XX-X-XXXX-XXXX
            rol: { type: 'string', pattern: '^[0-9]+-[0-9]+-[0-9]+-[0-9]+$' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              rol_sii: { type: 'string' },
              direccion: { type: 'string' },
              numero: { type: 'string' },
              block: { type: 'string' },
              depto: { type: 'string' },
              uso_suelo: { type: 'string' },
              superficie_terreno: { type: 'number' },
              superficie_construida: { type: 'number' },
              latitud: { type: 'number' },
              longitud: { type: 'number' },
              geometria: { type: 'object' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { rol } = request.params;
      const predio = await obtenerFichaPredio(request.tenant.esquemaBd, rol);
      return reply.status(200).send(predio);
    }
  );
}
