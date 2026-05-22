/**
 * log.js — Rutas de auditoría para SIG Municipal.
 *
 * GET /api/admin/log          — Lista paginada con filtros
 * GET /api/admin/log/exportar — Descarga CSV del log filtrado
 */

import { verificarToken, soloRoles } from '../middleware/auth.js'
import { obtenerLog, exportarLogCsv } from '../services/logService.js'
import { z } from 'zod'
import { validar } from '../utils/validators.js'

const TABLAS_VALIDAS     = ['capas', 'usuarios', 'municipios', 'reportes_ciudadanos']
const OPERACIONES_VALIDAS = ['INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ERROR']

const zFiltrosLog = z.object({
  tabla:      z.enum(TABLAS_VALIDAS).optional(),
  operacion:  z.enum(OPERACIONES_VALIDAS).optional(),
  usuarioId:  z.string().uuid().optional(),
  registroId: z.string().optional(),
  fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pagina:     z.string().optional().transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
  limite:     z.string().optional().transform((v) => (v ? Math.min(200, parseInt(v, 10)) : 50)),
})

/** @param {import('fastify').FastifyInstance} fastify */
export default async function rutasLog(fastify) {
  fastify.addHook('preHandler', verificarToken)
  fastify.addHook('preHandler', soloRoles('admin_municipal'))

  // ── GET /api/admin/log/exportar ────────────────────────────────────────
  // Registrar ANTES de /api/admin/log para evitar conflictos de ruta
  fastify.get('/api/admin/log/exportar', async (request, reply) => {
    const filtros = await validar(zFiltrosLog, request.query)
    const csv = await exportarLogCsv(request.tenant.id, filtros)

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="log_cambios.csv"')
    return reply.send(csv)
  })

  // ── GET /api/admin/log ─────────────────────────────────────────────────
  fastify.get('/api/admin/log', async (request, reply) => {
    const filtros  = await validar(zFiltrosLog, request.query)
    const resultado = await obtenerLog(request.tenant.id, filtros)
    return reply.status(200).send(resultado)
  })
}
