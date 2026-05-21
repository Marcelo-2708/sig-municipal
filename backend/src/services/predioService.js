/**
 * predioService.js — Lógica de búsqueda y consulta predial para SIG Municipal.
 *
 * Llama a la función SQL `buscar_predios(esquema, texto, limite)` definida
 * en el esquema del tenant en PostGIS.
 */

import { consultar } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Busca predios en el esquema del tenant usando la función PostGIS `buscar_predios`.
 *
 * @param {string} esquemaBd - Esquema del tenant (ej: 'municipio_concepcion')
 * @param {string} texto     - Texto de búsqueda (dirección, rol SII, nombre)
 * @param {number} limite    - Máximo de resultados (default 10)
 * @returns {Promise<Array>} Lista de predios encontrados
 */
export async function buscarPredios(esquemaBd, texto, limite = 10) {
  if (!texto || texto.trim().length < 3) {
    throw new AppError('La búsqueda debe tener al menos 3 caracteres', 400, 'BUSQUEDA_MUY_CORTA');
  }

  logger.debug({ esquemaBd, texto, limite }, 'Buscando predios');

  // La función buscar_predios debe existir en el esquema del tenant (creada por el DATABASE_AGENT)
  const resultado = await consultar(
    `SELECT * FROM buscar_predios($1, $2, $3)`,
    [texto.trim(), limite, esquemaBd],
    esquemaBd
  );

  return resultado.rows;
}

/**
 * Obtiene la ficha completa de un predio por su rol SII.
 * Solo retorna campos de acceso público.
 *
 * @param {string} esquemaBd - Esquema del tenant
 * @param {string} rolSii    - Rol SII del predio (ej: '15-1-0001-0001')
 * @returns {Promise<object>} Ficha del predio
 */
export async function obtenerFichaPredio(esquemaBd, rolSii) {
  logger.debug({ esquemaBd, rolSii }, 'Consultando ficha de predio por rol SII');

  // Campos públicos: excluye datos sensibles como propietario
  const resultado = await consultar(
    `SELECT
       rol_sii,
       direccion,
       numero,
       block,
       depto,
       uso_suelo,
       superficie_terreno,
       superficie_construida,
       ST_AsGeoJSON(geom)::json AS geometria,
       ST_X(ST_Centroid(geom)) AS longitud,
       ST_Y(ST_Centroid(geom)) AS latitud
     FROM predios
     WHERE rol_sii = $1
     LIMIT 1`,
    [rolSii],
    esquemaBd
  );

  if (resultado.rows.length === 0) {
    throw new AppError(`Predio con rol ${rolSii} no encontrado`, 404, 'PREDIO_NO_ENCONTRADO');
  }

  return resultado.rows[0];
}
