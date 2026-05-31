/**
 * tenant.js — Endpoint de información pública del tenant activo.
 *
 * GET /api/tenant/info — Sin autenticación.
 * Retorna el nombre, código y configuración pública del municipio activo.
 * Usado por el frontend para configurar el mapa (centro, zoom, fondo) por tenant.
 */

/** @param {import('fastify').FastifyInstance} fastify */
export default async function rutasTenant(fastify) {
  fastify.get(
    '/api/tenant/info',
    {
      schema: {
        description: 'Información pública del municipio activo',
        tags: ['Tenant'],
        response: {
          200: {
            type: 'object',
            properties: {
              id:     { type: 'string' },
              codigo: { type: 'string' },
              nombre: { type: 'string' },
              config: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id, codigo, nombre, config } = request.tenant
      return reply.send({ id, codigo, nombre, config })
    }
  )
}
