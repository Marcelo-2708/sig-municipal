/**
 * capas.js — Rutas de gestión de capas GIS para SIG Municipal.
 *
 * GET   /api/capas/publicas          — Capas visibles al público (sin auth)
 * GET   /api/admin/capas             — Todas las capas del municipio (funcionario+)
 * PATCH /api/admin/capas/orden       — Reordenar capas drag & drop (editor_gis+)
 * PATCH /api/admin/capas/:id         — Activar / desactivar capa (editor_gis+)
 * POST  /api/admin/capas/publicar    — Publicar nueva capa desde PostGIS (admin_municipal+)
 */

import { verificarToken, soloRoles } from '../middleware/auth.js';
import {
  obtenerCapasPublicas,
  obtenerTodasLasCapas,
  actualizarActivoCapa,
  reordenarCapas,
  publicarCapa,
} from '../services/capaService.js';
import { registrarLog } from '../services/logService.js';
import { zPaginacion, validar } from '../utils/validators.js';
import { z } from 'zod';

const TIPOS_VALIDOS = ['wms', 'wfs', 'geojson', 'mvt', 'raster'];

const zPublicarCapa = z.object({
  nombre: z.string().min(2).max(200).trim(),
  nombreInterno: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9_]+$/, 'Solo letras minúsculas, números y guiones bajos')
    .optional(),
  nombreTabla: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z_][a-z0-9_]*$/, 'Nombre de tabla inválido')
    .trim()
    .optional(),
  tipo: z.enum(TIPOS_VALIDOS).optional().default('wms'),
  visiblePorDefecto: z.boolean().optional().default(false),
  orden: z.number().int().min(0).optional().default(0),
  estiloPorDefecto: z.string().max(100).optional(),
  categoria: z.string().max(50).optional(),
  descripcion: z.string().max(500).optional(),
});

const zActualizarActivo = z.object({
  activo: z.boolean(),
});

const zOrden = z.object({
  capas: z
    .array(
      z.object({
        id: z.string().uuid(),
        orden: z.number().int().min(0),
      })
    )
    .min(1),
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
                id:                  { type: 'string' },
                nombre_interno:      { type: 'string' },
                nombre:              { type: 'string' },
                tipo:                { type: 'string' },
                tabla_origen:        { type: 'string' },
                url_wms:             { type: 'string' },
                url_wfs:             { type: 'string' },
                estilo_sld:          { type: 'string' },
                orden:               { type: 'integer' },
                categoria:           { type: 'string' },
                descripcion:         { type: 'string' },
                nombre_capa_wms:     { type: 'string', nullable: true },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
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

  // ── PATCH /api/admin/capas/orden ──────────────────────────────────────
  // Debe registrarse ANTES de /:id para que Fastify no confunda "orden" con un UUID
  fastify.patch(
    '/api/admin/capas/orden',
    {
      preHandler: [verificarToken, soloRoles('editor_gis')],
      schema: {
        description: 'Actualiza el orden de múltiples capas (drag & drop)',
        tags: ['Capas Admin'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['capas'],
          properties: {
            capas: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'orden'],
                properties: {
                  id:    { type: 'string', format: 'uuid' },
                  orden: { type: 'integer', minimum: 0 },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { capas } = await validar(zOrden, request.body);
      await reordenarCapas(capas, request.tenant.id);
      await registrarLog({
        usuarioId: request.usuario.sub, municipioId: request.tenant.id,
        tablaAfectada: 'capas', operacion: 'UPDATE',
        datosNuevos: { capas_reordenadas: capas.length },
        ipOrigen: request.ip,
        descripcion: `Reordenadas ${capas.length} capas`,
      });
      return reply.status(200).send({ ok: true });
    }
  );

  // ── PATCH /api/admin/capas/:id ────────────────────────────────────────
  fastify.patch(
    '/api/admin/capas/:id',
    {
      preHandler: [verificarToken, soloRoles('editor_gis')],
      schema: {
        description: 'Activa o desactiva una capa',
        tags: ['Capas Admin'],
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
          required: ['activo'],
          properties: {
            activo: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { activo } = await validar(zActualizarActivo, request.body);
      const capaActualizada = await actualizarActivoCapa(id, request.tenant.id, activo);
      await registrarLog({
        usuarioId: request.usuario.sub, municipioId: request.tenant.id,
        tablaAfectada: 'capas', operacion: 'UPDATE', registroId: id,
        datosAnteriores: { activo: !activo },
        datosNuevos:     { activo },
        ipOrigen: request.ip,
        descripcion: `Capa ${activo ? 'activada' : 'desactivada'}: ${capaActualizada.nombre_visible}`,
      });
      return reply.status(200).send(capaActualizada);
    }
  );

  // ── POST /api/admin/capas/publicar ────────────────────────────────────
  fastify.post(
    '/api/admin/capas/publicar',
    {
      preHandler: [verificarToken, soloRoles('admin_municipal')],
      schema: {
        description: 'Publica una tabla PostGIS como capa en GeoServer y la registra',
        tags: ['Capas Admin'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['nombre'],
          properties: {
            nombre:           { type: 'string' },
            nombreInterno:    { type: 'string' },
            nombreTabla:      { type: 'string' },
            tipo:             { type: 'string', enum: TIPOS_VALIDOS },
            visiblePorDefecto: { type: 'boolean' },
            orden:            { type: 'integer' },
            estiloPorDefecto: { type: 'string' },
            categoria:        { type: 'string' },
            descripcion:      { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const datos = await validar(zPublicarCapa, request.body);
      const capaCreada = await publicarCapa(datos, request.tenant.id, request.tenant);
      await registrarLog({
        usuarioId: request.usuario.sub, municipioId: request.tenant.id,
        tablaAfectada: 'capas', operacion: 'INSERT', registroId: capaCreada.id,
        datosNuevos: {
          nombre_visible: capaCreada.nombre_visible,
          nombre_interno: capaCreada.nombre_interno,
          tipo: capaCreada.tipo,
        },
        ipOrigen: request.ip,
        descripcion: `Capa publicada: ${capaCreada.nombre_visible}`,
      });
      return reply.status(201).send(capaCreada);
    }
  );
}
