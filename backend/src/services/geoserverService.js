/**
 * geoserverService.js — Cliente HTTP para la REST API de GeoServer.
 *
 * Provee métodos para publicar, eliminar y listar capas en GeoServer.
 * Usa fetch nativo (Node.js 18+). Todas las operaciones incluyen logs estructurados.
 */

import { config } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

// ── Cliente base ───────────────────────────────────────────────────────────

/**
 * Realiza una solicitud autenticada a la REST API de GeoServer.
 *
 * @param {string} ruta       - Ruta relativa (ej: '/workspaces')
 * @param {object} opciones   - Opciones fetch (method, body, headers)
 * @returns {Promise<object>} Respuesta JSON de GeoServer
 */
async function solicitudGeoServer(ruta, opciones = {}) {
  const url = `${config.geoserver.url}/rest${ruta}`;

  // Autenticación HTTP Basic con credenciales desde variables de entorno
  const credenciales = Buffer.from(
    `${config.geoserver.usuario}:${config.geoserver.contrasena}`
  ).toString('base64');

  const cabeceras = {
    Authorization: `Basic ${credenciales}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...opciones.headers,
  };

  let respuesta;
  try {
    respuesta = await fetch(url, {
      ...opciones,
      headers: cabeceras,
    });
  } catch (error) {
    logger.error({ err: error, url }, 'Error de red al conectar con GeoServer');
    throw new AppError(
      'No se pudo conectar con GeoServer. Verifica que esté disponible.',
      503,
      'GEOSERVER_NO_DISPONIBLE'
    );
  }

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => '');
    logger.error(
      { status: respuesta.status, url, cuerpo },
      'GeoServer retornó error HTTP'
    );
    throw new AppError(
      `GeoServer error ${respuesta.status}: ${cuerpo}`,
      502,
      'GEOSERVER_ERROR'
    );
  }

  // Algunas respuestas de GeoServer son vacías (ej: DELETE retorna 200 sin body)
  const texto = await respuesta.text();
  if (!texto) return {};

  try {
    return JSON.parse(texto);
  } catch {
    return { respuesta: texto };
  }
}

// ── Workspaces ─────────────────────────────────────────────────────────────

/**
 * Crea un workspace en GeoServer si no existe.
 *
 * @param {string} nombre - Nombre del workspace (ej: 'concepcion')
 */
export async function crearWorkspaceSiNoExiste(nombre) {
  try {
    await solicitudGeoServer(`/workspaces/${nombre}`);
    logger.debug({ workspace: nombre }, 'Workspace ya existe en GeoServer');
  } catch (error) {
    if (error.codigo === 'GEOSERVER_ERROR') {
      // El workspace no existe, crearlo
      await solicitudGeoServer('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ workspace: { name: nombre } }),
      });
      logger.info({ workspace: nombre }, 'Workspace creado en GeoServer');
    } else {
      throw error;
    }
  }
}

// ── Capas ──────────────────────────────────────────────────────────────────

/**
 * Publica una tabla PostGIS como capa en GeoServer.
 * Crea el datastore y el featuretype necesarios.
 *
 * @param {object} params
 * @param {string} params.workspace      - Nombre del workspace GeoServer
 * @param {string} params.nombreTabla    - Nombre de la tabla en PostGIS
 * @param {string} params.esquemaBd      - Esquema PostgreSQL del tenant
 * @param {string} params.nombreCapaGs   - Nombre de la capa en GeoServer
 * @param {string} [params.estiloPorDefecto] - Nombre del estilo SLD
 */
export async function publicarCapaGeoServer({
  workspace,
  nombreTabla,
  esquemaBd,
  nombreCapaGs,
  estiloPorDefecto,
}) {
  logger.info({ workspace, nombreTabla, esquemaBd }, 'Publicando capa en GeoServer');

  // Asegurar que el workspace exista
  await crearWorkspaceSiNoExiste(workspace);

  const nombreDatastore = `${workspace}_postgis`;

  // Crear o actualizar datastore PostGIS del tenant
  const configDatastore = {
    dataStore: {
      name: nombreDatastore,
      type: 'PostGIS',
      enabled: true,
      connectionParameters: {
        entry: [
          { '@key': 'host', $: config.baseDatos.host },
          { '@key': 'port', $: String(config.baseDatos.puerto) },
          { '@key': 'database', $: config.baseDatos.nombre },
          { '@key': 'user', $: config.baseDatos.usuario },
          { '@key': 'passwd', $: config.baseDatos.contrasena },
          { '@key': 'schema', $: esquemaBd },
          { '@key': 'dbtype', $: 'postgis' },
          { '@key': 'Expose primary keys', $: 'true' },
        ],
      },
    },
  };

  // Intentar crear el datastore (si ya existe, continuar)
  try {
    await solicitudGeoServer(`/workspaces/${workspace}/datastores`, {
      method: 'POST',
      body: JSON.stringify(configDatastore),
    });
    logger.debug({ workspace, nombreDatastore }, 'Datastore PostGIS creado en GeoServer');
  } catch (error) {
    // Ignorar error si el datastore ya existe (409 Conflict)
    if (!error.message?.includes('409')) throw error;
    logger.debug({ workspace, nombreDatastore }, 'Datastore PostGIS ya existía en GeoServer');
  }

  // Publicar el featuretype (capa)
  const configFeatureType = {
    featureType: {
      name: nombreCapaGs,
      nativeName: nombreTabla,
      title: nombreCapaGs,
      srs: 'EPSG:4326',
      enabled: true,
      ...(estiloPorDefecto && {
        defaultStyle: { name: estiloPorDefecto },
      }),
    },
  };

  await solicitudGeoServer(
    `/workspaces/${workspace}/datastores/${nombreDatastore}/featuretypes`,
    {
      method: 'POST',
      body: JSON.stringify(configFeatureType),
    }
  );

  logger.info({ workspace, nombreCapaGs, nombreTabla }, 'Capa publicada exitosamente en GeoServer');
}

/**
 * Elimina una capa de GeoServer (featuretype + layer).
 *
 * @param {string} workspace    - Workspace de la capa
 * @param {string} nombreCapa   - Nombre de la capa en GeoServer
 */
export async function eliminarCapaGeoServer(workspace, nombreCapa) {
  logger.info({ workspace, nombreCapa }, 'Eliminando capa de GeoServer');

  const nombreDatastore = `${workspace}_postgis`;

  try {
    // Eliminar featuretype (esto también elimina el layer asociado)
    await solicitudGeoServer(
      `/workspaces/${workspace}/datastores/${nombreDatastore}/featuretypes/${nombreCapa}?recurse=true`,
      { method: 'DELETE' }
    );
    logger.info({ workspace, nombreCapa }, 'Capa eliminada de GeoServer');
  } catch (error) {
    logger.error({ err: error, workspace, nombreCapa }, 'Error al eliminar capa de GeoServer');
    throw error;
  }
}

/**
 * Lista todas las capas publicadas en un workspace de GeoServer.
 *
 * @param {string} workspace
 * @returns {Promise<Array>} Lista de capas
 */
export async function listarCapas(workspace) {
  const respuesta = await solicitudGeoServer(
    `/workspaces/${workspace}/layers`
  );

  const capas = respuesta?.layers?.layer ?? [];
  return capas;
}
