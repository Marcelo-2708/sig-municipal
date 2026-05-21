/**
 * database.js — Pool de conexiones PostgreSQL/PostGIS para SIG Municipal.
 *
 * Exporta la función `consultar(sql, params, esquema)` que establece el
 * search_path antes de cada query para soportar el modelo multi-tenant.
 * Los errores de conexión son capturados y logueados con detalle.
 */

import pg from 'pg';
import { config } from './env.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

// ── Creación del pool ──────────────────────────────────────────────────────

const pool = new Pool({
  user: config.baseDatos.usuario,
  password: config.baseDatos.contrasena,
  database: config.baseDatos.nombre,
  host: config.baseDatos.host,
  port: config.baseDatos.puerto,
  max: config.baseDatos.poolMax,
  min: config.baseDatos.poolMin,
  idleTimeoutMillis: config.baseDatos.idleTimeoutMillis,
  connectionTimeoutMillis: 5000,
  // SSL solo en producción
  ssl: config.esProduccion ? { rejectUnauthorized: false } : false,
});

// ── Listeners del pool ────────────────────────────────────────────────────

pool.on('connect', (cliente) => {
  logger.debug({ host: config.baseDatos.host, db: config.baseDatos.nombre }, 'Nueva conexión al pool de BD establecida');
});

pool.on('error', (error, cliente) => {
  logger.error({ err: error }, 'Error inesperado en cliente inactivo del pool de BD');
});

// ── Función principal de consulta ─────────────────────────────────────────

/**
 * Ejecuta una consulta SQL en la base de datos.
 *
 * Si se proporciona un `esquema`, establece el search_path a `{esquema},public`
 * antes de ejecutar la query, permitiendo que las capas espaciales del tenant
 * se resuelvan correctamente.
 *
 * @param {string}   sql      - Consulta SQL parametrizada (usar $1, $2, ...)
 * @param {Array}    params   - Parámetros de la consulta (evita SQL injection)
 * @param {string}   [esquema] - Esquema del tenant (ej: 'municipio_concepcion')
 * @returns {Promise<pg.QueryResult>} Resultado de la consulta
 * @throws {Error} Si hay un error de conexión o de consulta
 */
export async function consultar(sql, params = [], esquema = null) {
  // Obtener un cliente dedicado para poder ejecutar SET search_path de forma segura
  const cliente = await pool.connect().catch((error) => {
    logger.error({ err: error }, 'No se pudo obtener conexión del pool de BD');
    throw new Error('Error de conexión a la base de datos');
  });

  try {
    // Si se especifica un esquema de tenant, ajustar el search_path
    if (esquema) {
      // Sanitizar el nombre del esquema para evitar SQL injection
      // Solo se permiten caracteres alfanuméricos y guiones bajos
      const esquemaSanitizado = esquema.replace(/[^a-zA-Z0-9_]/g, '');
      if (esquemaSanitizado !== esquema) {
        throw new Error(`Nombre de esquema inválido: ${esquema}`);
      }
      await cliente.query(`SET search_path TO ${esquemaSanitizado}, public`);
    }

    const resultado = await cliente.query(sql, params);
    return resultado;
  } catch (error) {
    logger.error(
      { err: error, sql: config.esProduccion ? '[OCULTO EN PROD]' : sql, esquema },
      'Error al ejecutar consulta en BD'
    );
    throw error;
  } finally {
    // Siempre liberar el cliente al pool, incluso si hay error
    cliente.release();
  }
}

/**
 * Ejecuta múltiples consultas dentro de una transacción.
 * Si alguna falla, hace rollback automático.
 *
 * @param {Function} callback - Función async que recibe el cliente y ejecuta las queries
 * @returns {Promise<*>} Resultado del callback
 */
export async function transaccion(callback) {
  const cliente = await pool.connect().catch((error) => {
    logger.error({ err: error }, 'No se pudo obtener conexión para transacción');
    throw new Error('Error de conexión a la base de datos');
  });

  try {
    await cliente.query('BEGIN');
    const resultado = await callback(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    logger.error({ err: error }, 'Transacción revertida por error');
    throw error;
  } finally {
    cliente.release();
  }
}

/**
 * Verifica que la conexión a la base de datos esté activa.
 * Usado por el endpoint /health.
 *
 * @returns {Promise<boolean>} true si la BD responde
 */
export async function verificarConexion() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Verificación de conexión a BD fallida');
    return false;
  }
}

export default pool;
