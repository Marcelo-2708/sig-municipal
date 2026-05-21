/**
 * superadmin.js — Rutas de gestión SaaS para SIG Municipal.
 *
 * Estas rutas NO pasan por el middleware de tenant.
 * Solo accesibles con rol super_admin.
 *
 * GET  /api/superadmin/municipios          — Lista todos los municipios
 * POST /api/superadmin/municipios          — Crea un municipio nuevo
 * PUT  /api/superadmin/municipios/:id/estado — Activa/desactiva municipio
 */

import { verificarToken, soloRoles } from '../middleware/auth.js';
import { consultar } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { z } from 'zod';
import { validar } from '../utils/validators.js';

// Esquema de validación para crear municipio
const zCrearMunicipio = z.object({
  nombre: z.string().min(2).max(150).trim(),
  codigo: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'El código solo puede contener letras minúsculas, números, guiones y guiones bajos')
    .trim(),
  region: z.string().max(100).optional(),
  esquemaBd: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z_][a-z0-9_]*$/, 'Nombre de esquema inválido')
    .optional(),
});

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function rutasSuperAdmin(fastify) {
  // Hook de auth aplicado a todas las rutas de este plugin
  fastify.addHook('preHandler', verificarToken);
  fastify.addHook('preHandler', soloRoles('super_admin'));

  // ── GET /api/superadmin/municipios ────────────────────────────────────
  fastify.get(
    '/api/superadmin/municipios',
    {
      schema: {
        description: 'Lista todos los municipios registrados en la plataforma',
        tags: ['SuperAdmin'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              municipios: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    nombre: { type: 'string' },
                    codigo: { type: 'string' },
                    region: { type: 'string' },
                    esquema_bd: { type: 'string' },
                    activo: { type: 'boolean' },
                    fecha_creacion: { type: 'string' },
                  },
                },
              },
              total: { type: 'integer' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const resultado = await consultar(
        `SELECT id, nombre, codigo, region, esquema_bd, activo, fecha_creacion
         FROM public.municipios
         ORDER BY nombre ASC`
      );

      return reply.status(200).send({
        municipios: resultado.rows,
        total: resultado.rowCount,
      });
    }
  );

  // ── POST /api/superadmin/municipios ───────────────────────────────────
  fastify.post(
    '/api/superadmin/municipios',
    {
      schema: {
        description: 'Crea un nuevo municipio en la plataforma',
        tags: ['SuperAdmin'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['nombre', 'codigo'],
          properties: {
            nombre: { type: 'string' },
            codigo: { type: 'string' },
            region: { type: 'string' },
            esquemaBd: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const datos = await validar(zCrearMunicipio, request.body);

      // El esquema_bd se deriva del código si no se especifica
      const esquemaBd = datos.esquemaBd ?? `municipio_${datos.codigo.replace(/-/g, '_')}`;

      // Verificar que el código no esté en uso
      const existente = await consultar(
        'SELECT id FROM public.municipios WHERE codigo = $1',
        [datos.codigo]
      );
      if (existente.rows.length > 0) {
        throw new AppError(
          `Ya existe un municipio con el código "${datos.codigo}"`,
          409,
          'CODIGO_EN_USO'
        );
      }

      const resultado = await consultar(
        `INSERT INTO public.municipios (nombre, codigo, region, esquema_bd, activo)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, nombre, codigo, region, esquema_bd, activo, fecha_creacion`,
        [datos.nombre, datos.codigo, datos.region ?? null, esquemaBd]
      );

      const municipio = resultado.rows[0];

      logger.info(
        { municipioId: municipio.id, codigo: municipio.codigo, nombre: municipio.nombre },
        'Nuevo municipio creado en la plataforma'
      );

      return reply.status(201).send(municipio);
    }
  );

  // ── PUT /api/superadmin/municipios/:id/estado ─────────────────────────
  fastify.put(
    '/api/superadmin/municipios/:id/estado',
    {
      schema: {
        description: 'Activa o desactiva un municipio en la plataforma',
        tags: ['SuperAdmin'],
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
      const { activo } = request.body;

      if (typeof activo !== 'boolean') {
        throw new AppError('El campo "activo" debe ser true o false', 422, 'VALIDACION_FALLIDA');
      }

      // Verificar que el municipio exista
      const existente = await consultar(
        'SELECT id, nombre, activo FROM public.municipios WHERE id = $1',
        [id]
      );
      if (existente.rows.length === 0) {
        throw new AppError('Municipio no encontrado', 404, 'MUNICIPIO_NO_ENCONTRADO');
      }

      const resultado = await consultar(
        `UPDATE public.municipios
         SET activo = $1, fecha_actualizacion = NOW()
         WHERE id = $2
         RETURNING id, nombre, codigo, activo`,
        [activo, id]
      );

      const municipio = resultado.rows[0];

      logger.info(
        { municipioId: id, nombre: municipio.nombre, activo },
        `Municipio ${activo ? 'activado' : 'desactivado'}`
      );

      return reply.status(200).send(municipio);
    }
  );
}
