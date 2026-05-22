/**
 * server.js — Entry point del servidor API de SIG Municipal.
 *
 * Responsabilidades:
 *   1. Cargar y validar variables de entorno
 *   2. Crear instancia de Fastify con logger
 *   3. Registrar plugins globales (CORS, Helmet, JWT, Rate Limit, Swagger)
 *   4. Registrar middleware global (tenant, error handler)
 *   5. Registrar todas las rutas
 *   6. Arrancar el servidor
 */

// Importar config primero — valida las variables de entorno al cargar
import { config } from './src/config/env.js';
import logger from './src/utils/logger.js';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { errorHandler } from './src/middleware/errorHandler.js';
import { resolverTenant } from './src/middleware/tenant.js';
import { configRateLimitGlobal } from './src/middleware/rateLimit.js';

// Rutas
import rutasHealth from './src/routes/health.js';
import rutasAuth from './src/routes/auth.js';
import rutasCapas from './src/routes/capas.js';
import rutasPredios from './src/routes/predios.js';
import rutasReportes from './src/routes/reportes.js';
import rutasSuperAdmin from './src/routes/superadmin.js';
import rutasUsuarios from './src/routes/usuarios.js';
import rutasLog from './src/routes/log.js';
import rutasStats from './src/routes/stats.js';

// ── Crear instancia de Fastify ────────────────────────────────────────────

const fastify = Fastify({
  // Usar la instancia de pino ya configurada
  logger,
  // Adjuntar request id a cada log
  genReqId: () => crypto.randomUUID(),
  trustProxy: true,
});

// ── Función principal de configuración ───────────────────────────────────

async function construirServidor() {
  // ── Plugins de seguridad ────────────────────────────────────────────

  // Helmet: cabeceras HTTP de seguridad
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // La CSP la maneja Nginx
  });

  // CORS: permitir solicitudes desde el frontend
  await fastify.register(cors, {
    origin: config.esProduccion
      ? (origin, cb) => {
          // En producción solo permitir subdominios del dominio base
          const permitido = !origin || origin.endsWith(`.${config.dominio.base}`);
          cb(null, permitido);
        }
      : true, // En desarrollo, permitir todos los orígenes
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Rate Limit global
  await fastify.register(rateLimit, configRateLimitGlobal);

  // JWT
  await fastify.register(jwt, {
    secret: config.jwt.secreto,
    // El token se busca en el header Authorization: Bearer <token>
    sign: {
      expiresIn: config.jwt.accessExpira,
    },
  });

  // ── Documentación Swagger (solo en desarrollo) ──────────────────────

  if (!config.esProduccion) {
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'SIG Municipal API',
          description: 'API REST para la plataforma WebGIS multi-tenant de municipalidades chilenas',
          version: '1.0.0',
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        tags: [
          { name: 'Sistema', description: 'Endpoints de estado del sistema' },
          { name: 'Autenticación', description: 'Login, logout y gestión de tokens' },
          { name: 'Capas', description: 'Capas GIS públicas' },
          { name: 'Capas Admin', description: 'Gestión de capas (requiere auth)' },
          { name: 'Predios', description: 'Búsqueda predial' },
          { name: 'Reportes', description: 'Reportes ciudadanos' },
          { name: 'Reportes Admin', description: 'Gestión de reportes (requiere auth)' },
          { name: 'SuperAdmin', description: 'Gestión de municipios (super_admin)' },
        ],
      },
    });

    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
    });

    logger.info('Documentación Swagger disponible en /docs');
  }

  // ── Middleware global ───────────────────────────────────────────────

  // Resolver tenant en todas las requests (excepto /health y /api/superadmin)
  fastify.addHook('onRequest', resolverTenant);

  // Handler global de errores
  fastify.setErrorHandler(errorHandler);

  // Handler para rutas no encontradas
  fastify.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      error: 'La ruta solicitada no existe',
      codigo: 'RUTA_NO_ENCONTRADA',
      statusCode: 404,
    });
  });

  // ── Registro de rutas ───────────────────────────────────────────────

  await fastify.register(rutasHealth);
  await fastify.register(rutasAuth);
  await fastify.register(rutasCapas);
  await fastify.register(rutasPredios);
  await fastify.register(rutasReportes);
  await fastify.register(rutasSuperAdmin);
  await fastify.register(rutasUsuarios);
  await fastify.register(rutasLog);
  await fastify.register(rutasStats);

  return fastify;
}

// ── Arrancar el servidor ──────────────────────────────────────────────────

async function iniciar() {
  try {
    const servidor = await construirServidor();

    await servidor.listen({
      port: config.servidor.puerto,
      host: config.servidor.host,
    });

    logger.info(
      {
        entorno: config.entorno,
        puerto: config.servidor.puerto,
        host: config.servidor.host,
      },
      `Servidor SIG Municipal arrancado en ${config.servidor.host}:${config.servidor.puerto}`
    );
  } catch (error) {
    logger.fatal({ err: error }, 'Error fatal al iniciar el servidor');
    process.exit(1);
  }
}

// Manejar señales de terminación para apagado limpio
process.on('SIGTERM', async () => {
  logger.info('Señal SIGTERM recibida — cerrando servidor...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Señal SIGINT recibida — cerrando servidor...');
  await fastify.close();
  process.exit(0);
});

iniciar();

// Exportar para tests
export { construirServidor };
