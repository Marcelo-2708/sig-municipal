/**
 * reporteService.js — CRUD de reportes ciudadanos para SIG Municipal.
 *
 * Los reportes se guardan en public.reportes_ciudadanos con referencia al municipio.
 * La geometría del punto se almacena como PostGIS geometry(Point, 4326).
 */

import { consultar } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

/** Estados válidos de un reporte */
const ESTADOS_VALIDOS = ['pendiente', 'en_revision', 'en_proceso', 'resuelto', 'rechazado'];

/**
 * Crea un nuevo reporte ciudadano.
 *
 * @param {object} datos     - Datos del reporte (tipo, descripcion, lat, lon, email)
 * @param {string} municipioId
 * @returns {Promise<object>} Reporte creado
 */
export async function crearReporte(datos, municipioId) {
  const { tipo, descripcion, lat, lon, email } = datos;

  const resultado = await consultar(
    `INSERT INTO public.reportes_ciudadanos
       (municipio_id, tipo, descripcion, email_ciudadano, estado,
        ubicacion, fecha_reporte)
     VALUES (
       $1, $2, $3, $4, 'pendiente',
       ST_SetSRID(ST_MakePoint($5, $6), 4326),
       NOW()
     )
     RETURNING
       id, tipo, descripcion, estado, fecha_reporte,
       ST_X(ubicacion) AS longitud,
       ST_Y(ubicacion) AS latitud`,
    [municipioId, tipo, descripcion, email ?? null, lon, lat]
  );

  const reporte = resultado.rows[0];

  logger.info(
    { reporteId: reporte.id, municipioId, tipo, lat, lon },
    'Reporte ciudadano creado exitosamente'
  );

  return reporte;
}

/**
 * Lista los reportes de un municipio con paginación y filtros opcionales.
 *
 * @param {string} municipioId
 * @param {object} opciones - { pagina, limite, estado, tipo }
 * @returns {Promise<{reportes: Array, total: number}>}
 */
export async function listarReportes(municipioId, opciones = {}) {
  const { pagina = 1, limite = 20, estado, tipo } = opciones;
  const offset = (pagina - 1) * limite;

  // Construir filtros dinámicos
  const filtros = ['municipio_id = $1'];
  const params = [municipioId];
  let indiceParam = 2;

  if (estado) {
    filtros.push(`estado = $${indiceParam++}`);
    params.push(estado);
  }
  if (tipo) {
    filtros.push(`tipo = $${indiceParam++}`);
    params.push(tipo);
  }

  const clausulaWhere = filtros.join(' AND ');

  const [resultadoReportes, resultadoTotal] = await Promise.all([
    consultar(
      `SELECT
         id, tipo, descripcion, estado, fecha_reporte, fecha_actualizacion,
         ST_X(ubicacion) AS longitud,
         ST_Y(ubicacion) AS latitud,
         email_ciudadano
       FROM public.reportes_ciudadanos
       WHERE ${clausulaWhere}
       ORDER BY fecha_reporte DESC
       LIMIT $${indiceParam} OFFSET $${indiceParam + 1}`,
      [...params, limite, offset]
    ),
    consultar(
      `SELECT COUNT(*) AS total FROM public.reportes_ciudadanos WHERE ${clausulaWhere}`,
      params
    ),
  ]);

  return {
    reportes: resultadoReportes.rows,
    total: parseInt(resultadoTotal.rows[0].total, 10),
    pagina,
    limite,
  };
}

/**
 * Cambia el estado de un reporte ciudadano.
 *
 * @param {string} reporteId
 * @param {string} nuevoEstado
 * @param {string} municipioId - Para verificar que el reporte pertenezca al tenant
 * @param {string} usuarioId   - Funcionario que cambia el estado
 * @returns {Promise<object>} Reporte actualizado
 */
export async function cambiarEstadoReporte(reporteId, nuevoEstado, municipioId, usuarioId) {
  if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
    throw new AppError(
      `Estado inválido. Estados permitidos: ${ESTADOS_VALIDOS.join(', ')}`,
      422,
      'ESTADO_INVALIDO'
    );
  }

  // Verificar que el reporte pertenezca al municipio
  const resultadoExistente = await consultar(
    'SELECT id, estado FROM public.reportes_ciudadanos WHERE id = $1 AND municipio_id = $2',
    [reporteId, municipioId]
  );

  if (resultadoExistente.rows.length === 0) {
    throw new AppError('Reporte no encontrado', 404, 'REPORTE_NO_ENCONTRADO');
  }

  const resultado = await consultar(
    `UPDATE public.reportes_ciudadanos
     SET estado = $1, fecha_actualizacion = NOW()
     WHERE id = $2
     RETURNING id, tipo, descripcion, estado, fecha_reporte, fecha_actualizacion`,
    [nuevoEstado, reporteId]
  );

  logger.info(
    {
      reporteId,
      estadoAnterior: resultadoExistente.rows[0].estado,
      nuevoEstado,
      municipioId,
      usuarioId,
    },
    'Estado de reporte ciudadano actualizado'
  );

  return resultado.rows[0];
}
