/**
 * capaService.js — Lógica de negocio para gestión de capas GIS en SIG Municipal.
 *
 * Interactúa con la tabla public.capas y con geoserverService
 * para publicar/despublicar capas en GeoServer.
 */

import { consultar } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { publicarCapaGeoServer, eliminarCapaGeoServer } from './geoserverService.js';

/**
 * Obtiene las capas visibles al público de un municipio.
 *
 * @param {string} municipioId - UUID del municipio (tenant)
 * @returns {Promise<Array>}
 */
export async function obtenerCapasPublicas(municipioId) {
  const resultado = await consultar(
    `SELECT id, nombre, descripcion, tipo_geometria, nombre_tabla,
            workspace_geoserver, nombre_capa_gs, estilo_sld, orden,
            metadata
     FROM public.capas
     WHERE municipio_id = $1
       AND visible_publico = true
       AND activo = true
     ORDER BY orden ASC, nombre ASC`,
    [municipioId]
  );

  return resultado.rows;
}

/**
 * Obtiene todas las capas de un municipio (incluyendo las no públicas).
 * Para uso del panel de administración.
 *
 * @param {string} municipioId
 * @param {object} paginacion - { pagina, limite }
 * @returns {Promise<{capas: Array, total: number}>}
 */
export async function obtenerTodasLasCapas(municipioId, paginacion = { pagina: 1, limite: 20 }) {
  const offset = (paginacion.pagina - 1) * paginacion.limite;

  const [resultadoCapas, resultadoTotal] = await Promise.all([
    consultar(
      `SELECT id, nombre, descripcion, tipo_geometria, nombre_tabla,
              workspace_geoserver, nombre_capa_gs, visible_publico, activo,
              orden, fecha_creacion, fecha_actualizacion
       FROM public.capas
       WHERE municipio_id = $1
       ORDER BY orden ASC, nombre ASC
       LIMIT $2 OFFSET $3`,
      [municipioId, paginacion.limite, offset]
    ),
    consultar(
      'SELECT COUNT(*) AS total FROM public.capas WHERE municipio_id = $1',
      [municipioId]
    ),
  ]);

  return {
    capas: resultadoCapas.rows,
    total: parseInt(resultadoTotal.rows[0].total, 10),
    pagina: paginacion.pagina,
    limite: paginacion.limite,
  };
}

/**
 * Activa o desactiva la visibilidad pública de una capa.
 *
 * @param {string} capaId   - UUID de la capa
 * @param {string} municipioId - UUID del municipio (para verificar pertenencia)
 * @returns {Promise<object>} Capa actualizada
 */
export async function toggleCapa(capaId, municipioId) {
  // Verificar que la capa pertenezca al tenant
  const resultadoCapa = await consultar(
    'SELECT id, nombre, visible_publico FROM public.capas WHERE id = $1 AND municipio_id = $2',
    [capaId, municipioId]
  );

  if (resultadoCapa.rows.length === 0) {
    throw new AppError('Capa no encontrada', 404, 'CAPA_NO_ENCONTRADA');
  }

  const capa = resultadoCapa.rows[0];
  const nuevoEstado = !capa.visible_publico;

  const resultado = await consultar(
    `UPDATE public.capas
     SET visible_publico = $1, fecha_actualizacion = NOW()
     WHERE id = $2
     RETURNING id, nombre, visible_publico, activo`,
    [nuevoEstado, capaId]
  );

  logger.info(
    { capaId, municipioId, nuevoEstado, nombreCapa: capa.nombre },
    `Visibilidad de capa ${nuevoEstado ? 'activada' : 'desactivada'}`
  );

  return resultado.rows[0];
}

/**
 * Publica una capa desde PostGIS hacia GeoServer.
 * Registra la capa en public.capas después de publicarla exitosamente.
 *
 * @param {object} datosCapa - Datos de la nueva capa
 * @param {string} municipioId
 * @param {object} tenant - Información del tenant (esquema_bd, codigo)
 * @returns {Promise<object>} Capa creada
 */
export async function publicarCapa(datosCapa, municipioId, tenant) {
  const {
    nombre,
    descripcion,
    nombreTabla,
    tipoGeometria,
    visiblePublico = false,
    orden = 0,
    estiloPorDefecto,
  } = datosCapa;

  logger.info({ municipioId, nombreTabla, nombre }, 'Iniciando publicación de capa en GeoServer');

  // Nombre del workspace en GeoServer (por convención: codigo del municipio)
  const workspace = tenant.codigo;
  const nombreCapaGs = `${workspace}:${nombreTabla}`;

  // Publicar en GeoServer
  await publicarCapaGeoServer({
    workspace,
    nombreTabla,
    esquemaBd: tenant.esquemaBd,
    nombreCapaGs: nombreTabla,
    estiloPorDefecto,
  });

  // Registrar en la tabla de capas
  const resultado = await consultar(
    `INSERT INTO public.capas
       (municipio_id, nombre, descripcion, tipo_geometria, nombre_tabla,
        workspace_geoserver, nombre_capa_gs, visible_publico, activo, orden)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
     RETURNING *`,
    [
      municipioId,
      nombre,
      descripcion ?? null,
      tipoGeometria ?? null,
      nombreTabla,
      workspace,
      nombreCapaGs,
      visiblePublico,
      orden,
    ]
  );

  const capaCreada = resultado.rows[0];

  logger.info(
    { capaId: capaCreada.id, municipioId, nombreCapaGs },
    'Capa publicada y registrada exitosamente'
  );

  return capaCreada;
}
