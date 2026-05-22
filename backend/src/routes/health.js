/**
 * health.js — Endpoint de salud para SIG Municipal.
 *
 * GET /health — Sin autenticación, sin tenant.
 * Comprueba BD PostgreSQL y GeoServer.
 * Usado por Docker healthcheck, load balancers y el dashboard de administración.
 */

import { verificarConexion } from '../config/database.js'
import { config } from '../config/env.js'

const VERSION = process.env.npm_package_version ?? '1.0.0'

/**
 * Pinga la REST API de GeoServer con timeout de 3 segundos.
 * @returns {Promise<boolean>}
 */
async function verificarGeoServer() {
  try {
    const credenciales = Buffer.from(
      `${config.geoserver.usuario}:${config.geoserver.contrasena}`
    ).toString('base64')

    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)

    const res = await fetch(`${config.geoserver.url}/rest/workspaces.json`, {
      headers: { Authorization: `Basic ${credenciales}` },
      signal: ctrl.signal,
    })

    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

/** @param {import('fastify').FastifyInstance} fastify */
export default async function rutasHealth(fastify) {
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Verificación de salud del servidor y servicios dependientes',
        tags: ['Sistema'],
        response: {
          200: {
            type: 'object',
            properties: {
              estado:     { type: 'string' },
              version:    { type: 'string' },
              timestamp:  { type: 'string' },
              baseDatos:  { type: 'string' },
              geoserver:  { type: 'string' },
            },
          },
        },
      },
      config: { rateLimit: false },
    },
    async (_request, reply) => {
      // Las dos verificaciones corren en paralelo
      const [bdOk, gsOk] = await Promise.all([
        verificarConexion(),
        verificarGeoServer(),
      ])

      return reply.status(200).send({
        estado:    'ok',
        version:   VERSION,
        timestamp: new Date().toISOString(),
        baseDatos: bdOk ? 'conectada'  : 'sin_conexion',
        geoserver: gsOk ? 'conectado'  : 'sin_conexion',
      })
    }
  )
}
