/**
 * env.js — Validación de variables de entorno al arrancar.
 *
 * Verifica que todas las variables críticas estén presentes y con valores
 * válidos antes de iniciar el servidor. Si falta alguna, lanza un error
 * descriptivo que indica exactamente qué variable configurar.
 */

import 'dotenv/config';

// ── Definición de variables requeridas ────────────────────────────────────

const VARIABLES_REQUERIDAS = [
  { nombre: 'DB_USER',       descripcion: 'Usuario de la base de datos PostgreSQL' },
  { nombre: 'DB_PASSWORD',   descripcion: 'Contraseña de la base de datos PostgreSQL' },
  { nombre: 'DB_NAME',       descripcion: 'Nombre de la base de datos PostgreSQL' },
  { nombre: 'DB_HOST',       descripcion: 'Host de la base de datos PostgreSQL' },
  { nombre: 'JWT_SECRET',    descripcion: 'Secreto para firmar tokens JWT (mínimo 32 caracteres)' },
  { nombre: 'GEOSERVER_URL', descripcion: 'URL base de GeoServer REST API' },
  { nombre: 'DOMINIO_BASE',  descripcion: 'Dominio base para resolver subdominios de municipios' },
];

/**
 * Valida todas las variables de entorno requeridas.
 * Lanza un error descriptivo si alguna está ausente o vacía.
 */
function validarVariablesDeEntorno() {
  const faltantes = [];

  for (const variable of VARIABLES_REQUERIDAS) {
    const valor = process.env[variable.nombre];
    if (!valor || valor.trim() === '') {
      faltantes.push(`  - ${variable.nombre}: ${variable.descripcion}`);
    }
  }

  if (faltantes.length > 0) {
    throw new Error(
      `[CONFIG] Faltan variables de entorno obligatorias:\n${faltantes.join('\n')}\n\n` +
      `Copia .env.example a .env y completa los valores faltantes.`
    );
  }

  // Validación adicional: JWT_SECRET debe tener al menos 32 caracteres
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error(
      '[CONFIG] JWT_SECRET debe tener al menos 32 caracteres para garantizar seguridad.'
    );
  }

  // Validación: NODE_ENV debe ser un valor conocido
  const entornosValidos = ['development', 'production', 'test'];
  const entorno = process.env.NODE_ENV ?? 'development';
  if (!entornosValidos.includes(entorno)) {
    throw new Error(
      `[CONFIG] NODE_ENV="${entorno}" no es válido. Valores permitidos: ${entornosValidos.join(', ')}`
    );
  }
}

// Ejecutar validación al importar este módulo
validarVariablesDeEntorno();

// ── Exportar configuración normalizada ────────────────────────────────────

/** @type {object} Configuración centralizada de la aplicación */
export const config = {
  entorno: process.env.NODE_ENV ?? 'development',
  esProduccion: process.env.NODE_ENV === 'production',
  esTest: process.env.NODE_ENV === 'test',

  servidor: {
    puerto: parseInt(process.env.PORT ?? '3000', 10),
    host: process.env.HOST ?? '0.0.0.0',
  },

  baseDatos: {
    usuario: process.env.DB_USER,
    contrasena: process.env.DB_PASSWORD,
    nombre: process.env.DB_NAME,
    host: process.env.DB_HOST,
    puerto: parseInt(process.env.DB_PORT ?? '5432', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX ?? '20', 10),
    poolMin: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT ?? '30000', 10),
  },

  jwt: {
    secreto: process.env.JWT_SECRET,
    accessExpira: process.env.JWT_ACCESS_EXPIRA ?? '15m',
    refreshExpira: process.env.JWT_REFRESH_EXPIRA ?? '7d',
  },

  geoserver: {
    url: process.env.GEOSERVER_URL,
    usuario: process.env.GEOSERVER_USER ?? 'admin',
    contrasena: process.env.GEOSERVER_PASSWORD ?? '',
  },

  dominio: {
    base: process.env.DOMINIO_BASE,
  },

  log: {
    nivel: process.env.LOG_LEVEL ?? 'info',
  },
};
