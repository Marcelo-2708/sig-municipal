/**
 * superadmin.js — Rutas de gestión SaaS para SIG Municipal.
 *
 * Estas rutas NO pasan por el middleware de tenant.
 * Solo accesibles con rol super_admin.
 *
 * GET  /api/superadmin/municipios             — Lista todos los municipios
 * POST /api/superadmin/municipios             — Crea un municipio (onboarding completo)
 * GET  /api/superadmin/municipios/:id         — Detalle de un municipio
 * PUT  /api/superadmin/municipios/:id/estado  — Activa/desactiva municipio
 */

import { verificarToken, soloRoles } from '../middleware/auth.js'
import { consultar } from '../config/database.js'
import { crearMunicipio, listarMunicipios } from '../services/municipioService.js'
import { AppError } from '../utils/AppError.js'
import logger from '../utils/logger.js'
import { z } from 'zod'
import { validar } from '../utils/validators.js'

const zCrearMunicipio = z.object({
  nombre:     z.string().min(2).max(150).trim(),
  codigo:     z.string().min(2).max(40)
               .regex(/^[a-z0-9_-]+$/, 'El código solo puede contener letras minúsculas, números, _ y -')
               .trim(),
  subdominio: z.string().min(2).max(63)
               .regex(/^[a-z0-9-]+$/, 'El subdominio solo puede contener letras minúsculas, números y -')
               .trim(),
  region:     z.string().max(100).optional(),
  provincia:  z.string().max(100).optional(),
  plan:       z.enum(['basico', 'estandar', 'premium']).default('basico'),
})

/** @param {import('fastify').FastifyInstance} fastify */
export default async function rutasSuperAdmin(fastify) {
  fastify.addHook('preHandler', verificarToken)
  fastify.addHook('preHandler', soloRoles('super_admin'))

  // ── GET /api/superadmin/municipios ──────────────────────────────────────
  fastify.get('/api/superadmin/municipios', async (_request, reply) => {
    const municipios = await listarMunicipios()
    return reply.status(200).send({ municipios, total: municipios.length })
  })

  // ── GET /api/superadmin/municipios/:id ──────────────────────────────────
  fastify.get('/api/superadmin/municipios/:id', async (request, reply) => {
    const { id } = request.params

    const res = await consultar(
      `SELECT m.id, m.codigo, m.nombre, m.subdominio, m.region, m.provincia,
              m.esquema_bd, m.activo, m.plan, m.config, m.creado_en,
              COUNT(DISTINCT u.id) FILTER (WHERE u.activo)  AS usuarios_activos,
              COUNT(DISTINCT c.id) FILTER (WHERE c.activo)  AS capas_activas
       FROM public.municipios m
       LEFT JOIN public.usuarios u ON u.municipio_id = m.id
       LEFT JOIN public.capas    c ON c.municipio_id = m.id
       WHERE m.id = $1
       GROUP BY m.id`,
      [id]
    )

    if (res.rows.length === 0)
      throw new AppError('Municipio no encontrado', 404, 'MUNICIPIO_NO_ENCONTRADO')

    return reply.status(200).send(res.rows[0])
  })

  // ── POST /api/superadmin/municipios ─────────────────────────────────────
  fastify.post(
    '/api/superadmin/municipios',
    {
      schema: {
        body: {
          type: 'object',
          required: ['nombre', 'codigo', 'subdominio'],
          properties: {
            nombre:     { type: 'string' },
            codigo:     { type: 'string' },
            subdominio: { type: 'string' },
            region:     { type: 'string' },
            provincia:  { type: 'string' },
            plan:       { type: 'string', enum: ['basico', 'estandar', 'premium'] },
          },
        },
      },
    },
    async (request, reply) => {
      const datos = await validar(zCrearMunicipio, request.body)

      logger.info(
        { codigo: datos.codigo, nombre: datos.nombre, operador: request.usuario?.sub },
        'Iniciando onboarding de municipio'
      )

      const { municipio, advertencias } = await crearMunicipio(datos)

      return reply.status(201).send({ municipio, advertencias })
    }
  )

  // ── PUT /api/superadmin/municipios/:id/estado ────────────────────────────
  fastify.put('/api/superadmin/municipios/:id/estado', async (request, reply) => {
    const { id } = request.params
    const { activo } = request.body

    if (typeof activo !== 'boolean')
      throw new AppError('El campo "activo" debe ser true o false', 422, 'VALIDACION_FALLIDA')

    const existente = await consultar(
      'SELECT id, nombre FROM public.municipios WHERE id = $1',
      [id]
    )
    if (existente.rows.length === 0)
      throw new AppError('Municipio no encontrado', 404, 'MUNICIPIO_NO_ENCONTRADO')

    const res = await consultar(
      `UPDATE public.municipios
       SET activo = $1, actualizado_en = NOW()
       WHERE id = $2
       RETURNING id, nombre, codigo, activo`,
      [activo, id]
    )

    logger.info(
      { municipioId: id, nombre: res.rows[0].nombre, activo },
      `Municipio ${activo ? 'activado' : 'desactivado'}`
    )

    return reply.status(200).send(res.rows[0])
  })
}
