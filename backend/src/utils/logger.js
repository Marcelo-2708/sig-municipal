/**
 * logger.js — Instancia de Pino configurada para SIG Municipal.
 *
 * Serializa automáticamente los campos: tenant, usuario, metodo, ruta.
 * El nivel de log se controla mediante la variable de entorno LOG_LEVEL.
 */

import pino from 'pino';

// Nivel de log por defecto: "info"
const nivel = process.env.LOG_LEVEL ?? 'info';
const esDesarrollo = process.env.NODE_ENV !== 'production';

const opciones = {
  level: nivel,

  // Serializers personalizados para campos frecuentes
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      metodo: req.method,
      ruta: req.url,
      ip: req.ip,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },

  // Campos base que aparecen en todos los logs
  base: {
    servicio: 'sig-municipal-backend',
    entorno: process.env.NODE_ENV ?? 'development',
  },

  // Formato de timestamp legible
  timestamp: pino.stdTimeFunctions.isoTime,
};

// En desarrollo, activar pretty-print para mayor legibilidad en consola
const transporte = esDesarrollo
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname,servicio,entorno',
      },
    }
  : undefined;

const logger = pino(opciones, transporte ? pino.transport(transporte) : undefined);

export default logger;
