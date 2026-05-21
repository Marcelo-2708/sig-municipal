/**
 * rateLimit.js — Configuración de rate limiting para SIG Municipal.
 *
 * Límites definidos:
 *   - General: 100 requests/minuto por IP
 *   - Rutas de autenticación: 10 requests/minuto por IP (anti brute-force)
 */

/**
 * Configuración global de rate limit.
 * Se registra en el plugin @fastify/rate-limit al iniciar el servidor.
 */
export const configRateLimitGlobal = {
  max: 100,
  timeWindow: '1 minute',
  // Mensaje de error en español
  errorResponseBuilder: (_request, context) => ({
    error: 'Demasiadas solicitudes. Por favor espera un momento.',
    codigo: 'RATE_LIMIT_EXCEDIDO',
    statusCode: 429,
    limite: context.max,
    ventana: context.after,
  }),
  // Cabeceras estándar de rate limit
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true,
  },
};

/**
 * Configuración estricta para rutas de autenticación.
 * Se aplica directamente en las rutas /api/auth/* como opción de config.
 *
 * Uso en ruta Fastify:
 *   fastify.post('/api/auth/login', { config: rateLimitAuth }, handler)
 */
export const rateLimitAuth = {
  rateLimit: {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Clave por IP + email para mayor granularidad
      const email = request.body?.email ?? '';
      return `${request.ip}:${email}`;
    },
    errorResponseBuilder: (_request, context) => ({
      error: 'Demasiados intentos de autenticación. Espera 1 minuto antes de intentar de nuevo.',
      codigo: 'AUTH_RATE_LIMIT_EXCEDIDO',
      statusCode: 429,
      limite: context.max,
      ventana: context.after,
    }),
  },
};
