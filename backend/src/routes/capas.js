/**
 * capas.js — Rutas de gestión de capas GIS para SIG Municipal.
 *
 * GET  /api/capas/publicas          — Capas visibles al público (sin auth)
 * GET  /api/admin/capas             — Todas las capas (funcionario+)
 * PUT  /api/admin/capas/:id/toggle  — Activa/desactiva capa (editor_gis+)
 * POST /api/admin/capas/publicar    — Publica capa desde PostGIS (admin_municipal+)
 */

import { verificarToken, soloRoles } from '../middleware/auth.js';
import {
  obtenerCapasPublicas,
  obtenerTodasLasCapas,
  toggleCapa,
  publicarCapa,
} from '../services/capaService.js';
import { zPaginacion, validar } from '../utils/validators.js';
import { z } from 'zod';

// Esquema de validación para publicar capa
const zPublicarCapa = z.object({
  nombre: z.string().min(2).max(100).trim(),
  descripcion: z.string().max(500).optional(),
  nombreTabla: z.string().min(2).max(63).regex(/^[a-z_][a-z0-9_]*$/, 'Nombre de tabla inválido').trim(),
  tipoGeometria: z.enum(['POINT', 'LINESTRING', 'POLYGON', 'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON']).optional(),
  visiblePublico: z.boolean().optional().default(false),
  orden: z.number().int().min(0).optional().default(0),
  estiloPorDefecto: z.string().optional(),
});

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function rutasCapas(fastify) {
  // ── GET /api/capas/publicas ───────────────────────────────────────────
  fastify.get(
    '/api/capas/publicas',
    {
      schema: {
        description: 'Lista las capas visibles al público del municipio',
        tags: ['Capas'],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                nombre: { type: 'string' },
                descripcion: { type: 'string' },
                tipo_geometria: { type: 'string' },
                workspace_geoserver: { type: 'string' },
                nombre_capa_gs: { type: 'string' },
                orden: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // request.tenant fue resuelto por el middleware de tenant
      const capas = await obtenerCapasPublicas(request.tenant.id);
      return reply.status(200).send(capas);
    }
  );

  // ── GET /api/admin/capas ──────────────────────────────────────────────
  fastify.get(
    '/api/admin/capas',
    {
      preHandler: [verificarToken, soloRoles('funcionario')],
      schema: {
        description: 'Lista todas las capas del municipio (admin)',
        tags: ['Capas Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            pagina: { type: 'string' },
            limite: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const paginacion = await validar(zPaginacion, request.query);
      const resultado = await obtenerTodasLasCapas(request.tenant.id, paginacion);
      return reply.status(200).send(resultado);
    }
  );

  // ── PUT /api/admin/capas/:id/toggle ───────────────────────────────────
  fastify.put(
    '/api/admin/capas/:id/toggle',
    {
      preHandler: [verificarToken, soloRoles('editor_gis')],
      schema: {
        description: 'Activa o desactiva la visibilidad pública de una capa',
        tags: ['Capas Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const capaActualizada = await toggleCapa(id, request.tenant.id);
      return reply.status(200).send(capaActualizada);
    }
  );

  // ── POST /api/admin/capas/publicar ────────────────────────────────────
  fastify.post(
    '/api/admin/capas/publicar',
    {
      preHandler: [verificarToken, soloRoles('admin_municipal')],
      schema: {
        description: 'Publica una tabla PostGIS como capa en GeoServer',
        tags: ['Capas Admin'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['nombre', 'nombreTabla'],
          properties: {
            nombre: { type: 'string' },
            descripcion: { type: 'string' },
            nombreTabla: { type: 'string' },
            tipoGeometria: { type: 'string' },
            visiblePublico: { type: 'boolean' },
            orden: { type: 'integer' },
            estiloPorDefecto: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const datos = await validar(zPublicarCapa, request.body);
      const capaCreada = await publicarCapa(datos, request.tenant.id, request.tenant);
      return reply.status(201).send(capaCreada);
    }
  );
}
