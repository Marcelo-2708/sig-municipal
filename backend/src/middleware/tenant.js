/**
 * tenant.js — Middleware de resolución de tenant (municipio) por subdominio.
 *
 * Extrae el subdominio del header Host, lo busca en public.municipios,
 * y adjunta el tenant a request.tenant. Retorna 404 si no existe y 403 si
 * el municipio está inactivo.
 *
 * Rutas bypaseadas (no requieren tenant):
 *   - GET /health
 *   - /api/superadmin/*
 */

import { consultar } from '../config/database.js';
import { config } from '../config/env.js';
import logger from '../utils/logger.js';

// Rutas que no requieren resolución de tenant
const RUTAS_SIN_TENANT = ['/health', '/api/superadmin'];

/**
 * Hook de Fastify que resuelve el tenant desde el subdominio del Host header.
 * Se registra globalmente con addHook('onRequest', resolverTenant).
 *
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
export async function resolverTenant(request, reply) {
  const ruta = request.url;

  // Bypassear rutas que no necesitan tenant
  const esBypass = RUTAS_SIN_TENANT.some((prefijo) => ruta === prefijo || ruta.startsWith(`${prefijo}/`));
  if (esBypass) {
    return;
  }

  // Extraer host sin puerto
  const hostCompleto = request.headers.host ?? '';
  const host = hostCompleto.split(':')[0];

  // Determinar subdominio según el dominio base configurado
  // Ejemplo: "sig.concepcion.cl" con dominioBase "sig.municipalidad.cl"
  // → subdominio = "concepcion"
  // En desarrollo, se acepta también "concepcion.localhost"
  let subdominio = null;

  const dominioBase = config.dominio.base;
  if (host.endsWith(`.${dominioBase}`)) {
    subdominio = host.slice(0, host.length - dominioBase.length - 1);
  } else if (config.entorno !== 'production') {
    // En desarrollo: host = "concepcion.localhost" o "concepcion.127.0.0.1.nip.io"
    const partes = host.split('.');
    if (partes.length >= 2) {
      subdominio = partes[0];
    }
  }

  if (!subdominio || subdominio.trim() === '') {
    logger.warn({ host }, 'No se pudo extraer subdominio del Host header');
    return reply.status(404).send({
      error: 'Municipio no encontrado',
      codigo: 'TENANT_NO_ENCONTRADO',
      statusCode: 404,
    });
  }

  // Buscar municipio en la BD por su código (subdominio)
  try {
    const resultado = await consultar(
      `SELECT id, codigo, nombre, esquema_bd, activo
       FROM public.municipios
       WHERE codigo = $1
       LIMIT 1`,
      [subdominio.toLowerCase()]
    );

    if (resultado.rows.length === 0) {
      logger.warn({ subdominio, host }, 'Municipio no encontrado para subdominio');
      return reply.status(404).send({
        error: 'Municipio no encontrado',
        codigo: 'TENANT_NO_ENCONTRADO',
        statusCode: 404,
      });
    }

    const municipio = resultado.rows[0];

    // Verificar que el municipio esté activo
    if (!municipio.activo) {
      logger.warn({ subdominio, municipioId: municipio.id }, 'Intento de acceso a municipio inactivo');
      return reply.status(403).send({
        error: 'Este municipio no está activo en la plataforma',
        codigo: 'TENANT_INACTIVO',
        statusCode: 403,
      });
    }

    // Adjuntar información del tenant a la request
    request.tenant = {
      id: municipio.id,
      codigo: municipio.codigo,
      nombre: municipio.nombre,
      esquemaBd: municipio.esquema_bd,
      activo: municipio.activo,
    };

    logger.debug({ tenantId: municipio.id, tenantCodigo: municipio.codigo }, 'Tenant resuelto correctamente');
  } catch (error) {
    logger.error({ err: error, subdominio }, 'Error al resolver tenant desde BD');
    return reply.status(500).send({
      error: 'Error interno al resolver el municipio',
      codigo: 'ERROR_INTERNO',
      statusCode: 500,
    });
  }
}
