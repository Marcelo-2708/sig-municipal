/**
 * stats.js — Métricas del municipio para el dashboard de administración.
 *
 * GET /api/admin/stats — Contadores y marcas de tiempo del tenant actual
 */

import { verificarToken, soloRoles } from '../middleware/auth.js'
import { consultar } from '../config/database.js'

/** @param {import('fastify').FastifyInstance} fastify */
export default async function rutasStats(fastify) {
  fastify.get(
    '/api/admin/stats',
    { preHandler: [verificarToken, soloRoles('funcionario')] },
    async (request, reply) => {
      const { id: municipioId } = request.tenant

      const res = await consultar(
        `SELECT
           (SELECT COUNT(*)::int
              FROM public.capas
             WHERE municipio_id = $1 AND activo)                                        AS capas_activas,
           (SELECT COUNT(*)::int
              FROM public.capas
             WHERE municipio_id = $1)                                                   AS total_capas,
           (SELECT MAX(actualizado_en)
              FROM public.capas
             WHERE municipio_id = $1)                                                   AS ultima_capa_actualizada,
           (SELECT COUNT(*)::int
              FROM public.usuarios
             WHERE municipio_id = $1 AND activo)                                        AS usuarios_activos,
           (SELECT COUNT(*)::int
              FROM public.usuarios
             WHERE municipio_id = $1)                                                   AS total_usuarios,
           (SELECT COUNT(*)::int
              FROM public.reportes_ciudadanos
             WHERE municipio_id = $1 AND estado = 'pendiente')                          AS reportes_pendientes,
           (SELECT MAX(creado_en)
              FROM public.log_cambios
             WHERE municipio_id = $1)                                                   AS ultima_actividad`,
        [municipioId]
      )

      return reply.status(200).send(res.rows[0])
    }
  )
}
