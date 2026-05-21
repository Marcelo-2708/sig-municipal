/**
 * reportes.js — Rutas de reportes ciudadanos para SIG Municipal.
 *
 * POST /api/reportes                    — Crear reporte (sin auth)
 * GET  /api/admin/reportes              — Listar reportes (funcionario+)
 * PUT  /api/admin/reportes/:id/estado   — Cambiar estado (funcionario+)
 */

import { verificarToken, soloRoles } from '../middleware/auth.js';
import { crearReporte, listarReportes, cambiarEstadoReporte } from '../services/reporteService.js';
import { zReporte, zPaginacion, validar } from '../utils/validators.js';
import { z } from 'zod';

const zCambioEstado = z.object({
  estado: z.enum(['pendiente', 'en_revision', 'en_proceso', 'resuelto', 'rechazado']),
});

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function rutasReportes(fastify) {
  // ── POST /api/reportes ────────────────────────────────────────────────
  fastify.post(
    '/api/reportes',
    {
      schema: {
        description: 'Crear un reporte ciudadano geolocalizando el problema',
        tags: ['Reportes'],
        body: {
          type: 'object',
          required: ['tipo', 'descripcion', 'lat', 'lon'],
          properties: {
            tipo: {
              type: 'string',
              enum: ['bache', 'iluminacion', 'basura', 'arbol', 'semaforo', 'otro'],
            },
            descripcion: { type: 'string', minLength: 10, maxLength: 1000 },
            lat: { type: 'number' },
            lon: { type: 'number' },
            email: { type: 'string', format: 'email' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              tipo: { type: 'string' },
              estado: { type: 'string' },
              fecha_reporte: { type: 'string' },
              latitud: { type: 'number' },
              longitud: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const datos = await validar(zReporte, request.body);
      const reporte = await crearReporte(datos, request.tenant.id);
      return reply.status(201).send(reporte);
    }
  );

  // ── GET /api/admin/reportes ───────────────────────────────────────────
  fastify.get(
    '/api/admin/reportes',
    {
      preHandler: [verificarToken, soloRoles('funcionario')],
      schema: {
        description: 'Lista los reportes ciudadanos del municipio',
        tags: ['Reportes Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            pagina: { type: 'string' },
            limite: { type: 'string' },
            estado: {
              type: 'string',
              enum: ['pendiente', 'en_revision', 'en_proceso', 'resuelto', 'rechazado'],
            },
            tipo: {
              type: 'string',
              enum: ['bache', 'iluminacion', 'basura', 'arbol', 'semaforo', 'otro'],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const paginacion = await validar(zPaginacion, request.query);
      const { estado, tipo } = request.query;

      const resultado = await listarReportes(request.tenant.id, {
        ...paginacion,
        estado,
        tipo,
      });

      return reply.status(200).send(resultado);
    }
  );

  // ── PUT /api/admin/reportes/:id/estado ────────────────────────────────
  fastify.put(
    '/api/admin/reportes/:id/estado',
    {
      preHandler: [verificarToken, soloRoles('funcionario')],
      schema: {
        description: 'Cambia el estado de un reporte ciudadano',
        tags: ['Reportes Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['estado'],
          properties: {
            estado: {
              type: 'string',
              enum: ['pendiente', 'en_revision', 'en_proceso', 'resuelto', 'rechazado'],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { estado } = await validar(zCambioEstado, request.body);

      const reporteActualizado = await cambiarEstadoReporte(
        id,
        estado,
        request.tenant.id,
        request.usuario.sub
      );

      return reply.status(200).send(reporteActualizado);
    }
  );
}
