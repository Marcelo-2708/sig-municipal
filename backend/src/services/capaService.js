/**
 * capaService.js — Lógica de negocio para gestión de capas GIS en SIG Municipal.
 *
 * Interactúa con la tabla public.capas y con geoserverService
 * para publicar capas en GeoServer.
 *
 * Columnas reales de public.capas:
 *   nombre_interno, nombre_visible, tipo, tabla_origen,
 *   url_wms, url_wfs, estilo_sld, visible_por_defecto,
 *   activo, orden, metadata (JSONB), epsg, bbox_*
 */

import { consultar } from '../config/database.js';
import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { publicarCapaGeoServer } from './geoserverService.js';

// ── Consultas de lectura ───────────────────────────────────────────────────

/**
 * Obtiene las capas visibles por defecto de un municipio (para el mapa público).
 *
 * @param {string} municipioId
 */
export async function obtenerCapasPublicas(municipioId) {
  const resultado = await consultar(
    `SELECT id, nombre_interno, nombre_visible AS nombre, tipo,
            tabla_origen, url_wms, url_wfs, estilo_sld,
            bbox_minx, bbox_miny, bbox_maxx, bbox_maxy, epsg,
            visible_por_defecto, orden,
            metadata->>'categoria'      AS categoria,
            metadata->>'descripcion'    AS descripcion,
            metadata->>'nombre_capa_wms' AS nombre_capa_wms
     FROM public.capas
     WHERE municipio_id = $1
       AND visible_por_defecto = true
       AND activo = true
     ORDER BY orden ASC, nombre_visible ASC`,
    [municipioId]
  );

  return resultado.rows;
}

/**
 * Obtiene todas las capas de un municipio (incluyendo privadas e inactivas).
 * Para el panel de administración.
 *
 * @param {string} municipioId
 * @param {{ pagina: number, limite: number }} paginacion
 */
export async function obtenerTodasLasCapas(municipioId, paginacion = { pagina: 1, limite: 50 }) {
  const offset = (paginacion.pagina - 1) * paginacion.limite;

  const [resultadoCapas, resultadoTotal] = await Promise.all([
    consultar(
      `SELECT id, nombre_interno, nombre_visible AS nombre, tipo,
              tabla_origen, url_wms, url_wfs, estilo_sld,
              visible_por_defecto, activo, orden,
              metadata->>'categoria'   AS categoria,
              metadata->>'descripcion' AS descripcion,
              creado_en, actualizado_en
       FROM public.capas
       WHERE municipio_id = $1
       ORDER BY orden ASC, nombre_visible ASC
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

// ── Mutaciones ─────────────────────────────────────────────────────────────

/**
 * Activa o desactiva una capa (campo `activo`).
 * Verifica que la capa pertenezca al tenant antes de actualizar.
 *
 * @param {string} capaId
 * @param {string} municipioId
 * @param {boolean} activo
 */
export async function actualizarActivoCapa(capaId, municipioId, activo) {
  const verificacion = await consultar(
    'SELECT id, nombre_visible FROM public.capas WHERE id = $1 AND municipio_id = $2',
    [capaId, municipioId]
  );

  if (verificacion.rows.length === 0) {
    throw new AppError('Capa no encontrada', 404, 'CAPA_NO_ENCONTRADA');
  }

  const resultado = await consultar(
    `UPDATE public.capas
     SET activo = $1, actualizado_en = NOW()
     WHERE id = $2
     RETURNING id, nombre_visible AS nombre, visible_por_defecto, activo, orden`,
    [activo, capaId]
  );

  logger.info(
    { capaId, municipioId, activo, nombreCapa: verificacion.rows[0].nombre_visible },
    `Capa ${activo ? 'activada' : 'desactivada'}`
  );

  return resultado.rows[0];
}

/**
 * Actualiza el orden de múltiples capas en una sola operación.
 * Verifica que todas las capas pertenezcan al tenant.
 *
 * @param {{ id: string, orden: number }[]} items
 * @param {string} municipioId
 */
export async function reordenarCapas(items, municipioId) {
  if (!items.length) return;

  const ids = items.map((i) => i.id);
  const ordenes = items.map((i) => i.orden);

  // Verificar que todas pertenezcan al tenant
  const verificacion = await consultar(
    'SELECT COUNT(*) AS total FROM public.capas WHERE id = ANY($1) AND municipio_id = $2',
    [ids, municipioId]
  );

  if (parseInt(verificacion.rows[0].total, 10) !== items.length) {
    throw new AppError(
      'Una o más capas no pertenecen al municipio',
      403,
      'ACCESO_DENEGADO'
    );
  }

  await consultar(
    `UPDATE public.capas AS c
     SET orden = v.orden, actualizado_en = NOW()
     FROM unnest($1::uuid[], $2::integer[]) AS v(id, orden)
     WHERE c.id = v.id AND c.municipio_id = $3`,
    [ids, ordenes, municipioId]
  );

  logger.info({ municipioId, cantidad: items.length }, 'Orden de capas actualizado');
}

/**
 * Publica una tabla PostGIS como capa en GeoServer y la registra en la BD.
 *
 * @param {object} datosCapa
 * @param {string} municipioId
 * @param {{ codigo: string, nombre: string, esquemaBd: string }} tenant
 */
export async function publicarCapa(datosCapa, municipioId, tenant) {
  const {
    nombre,
    nombreInterno,
    nombreTabla,
    tipo = 'wms',
    visiblePorDefecto = false,
    orden = 0,
    estiloPorDefecto,
    categoria,
    descripcion,
  } = datosCapa;

  const workspace = tenant.codigo;
  const nombreInternoFinal = nombreInterno || _slugify(nombre);

  logger.info({ municipioId, nombreTabla, nombre, workspace }, 'Iniciando publicación de capa');

  // Solo publica en GeoServer si hay tabla PostGIS asociada
  if (nombreTabla) {
    await publicarCapaGeoServer({
      workspace,
      nombreTabla,
      esquemaBd: tenant.esquemaBd,
      nombreCapaGs: nombreInternoFinal,
      estiloPorDefecto,
    });
  }

  const urlBase = config.geoserver.url;
  const urlWms = `${urlBase}/${workspace}/wms`;
  const urlWfs = nombreTabla ? `${urlBase}/${workspace}/wfs` : null;

  const metadata = {
    ...(descripcion && { descripcion }),
    ...(categoria && { categoria }),
    fuente: `${tenant.nombre} — administrador`,
    fecha_actualizacion: new Date().toISOString().split('T')[0],
  };

  const resultado = await consultar(
    `INSERT INTO public.capas
       (municipio_id, nombre_interno, nombre_visible, tipo, tabla_origen,
        url_wms, url_wfs, estilo_sld, visible_por_defecto, activo, orden, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11)
     RETURNING id, nombre_interno, nombre_visible AS nombre, tipo, tabla_origen,
               url_wms, url_wfs, estilo_sld, visible_por_defecto, activo, orden, metadata`,
    [
      municipioId,
      nombreInternoFinal,
      nombre,
      tipo,
      nombreTabla ?? null,
      urlWms,
      urlWfs,
      estiloPorDefecto ?? null,
      visiblePorDefecto,
      orden,
      JSON.stringify(metadata),
    ]
  );

  const capaCreada = resultado.rows[0];

  logger.info(
    { capaId: capaCreada.id, municipioId, workspace, nombreInternoFinal },
    'Capa publicada y registrada exitosamente'
  );

  return capaCreada;
}

// ── Helpers privados ───────────────────────────────────────────────────────

function _slugify(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 63);
}
