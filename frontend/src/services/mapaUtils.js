/**
 * Utilidades para manipular capas WMS en el mapa MapLibre.
 *
 * Convenciones:
 * - Los IDs internos de capas en MapLibre siguen el patrón: `wms-{id}`
 * - Las peticiones WMS usan EPSG:3857 (Web Mercator) como exige el estándar
 * - Las geometrías de la aplicación siempre en WGS84 (EPSG:4326)
 */

// Prefijo para identificar capas WMS agregadas programáticamente
const PREFIJO_CAPA_WMS = 'wms-'

/**
 * Construye la URL de tiles WMS para una capa dada.
 * @param {string} endpointWms - URL completa del endpoint WMS (ej: https://host/wms)
 * @param {string} nombreCapa  - Nombre de la capa tal como lo espera el servidor WMS
 * @returns {string} URL de tiles WMS con parámetros GetMap
 */
function construirUrlWMS(endpointWms, nombreCapa) {
  // Construido como string literal — NO usar URLSearchParams porque:
  //   • codifica ":" → "%3A"  (rompe "demo:capa" en GeoServer)
  //   • codifica "{" → "%7B"  (rompe "{bbox-epsg-3857}" que MapLibre sustituye en runtime)
  return (
    `${endpointWms}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${nombreCapa}&WIDTH=256&HEIGHT=256` +
    `&SRS=EPSG:3857&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
    `&BBOX={bbox-epsg-3857}`
  )
}

/**
 * Agrega una capa WMS al mapa MapLibre.
 * Si la capa ya existe, no hace nada.
 *
 * Soporta dos modos:
 * - Capa GeoServer (tabla_origen != null): usa geoserverUrl del entorno + nombre_interno
 * - Capa WMS externa (tabla_origen == null): usa url_wms de la BD + nombre_capa_wms
 *
 * @param {maplibregl.Map} mapa              - Instancia del mapa
 * @param {object}         capa              - Objeto capa del backend
 * @param {string}         capa.id           - ID único de la capa
 * @param {string}         capa.nombre_interno    - Nombre interno (slug)
 * @param {string|null}    capa.tabla_origen - Tabla PostGIS asociada (null = WMS externo)
 * @param {string|null}    capa.url_wms      - Endpoint WMS (para capas externas)
 * @param {string|null}    capa.nombre_capa_wms   - Nombre real de la capa en el servidor WMS externo
 * @param {number}         [capa.opacidad=1] - Opacidad (0-1)
 * @param {string}         geoserverUrl      - URL pública del GeoServer (entorno)
 */
export function agregarCapaWMS(mapa, capa, geoserverUrl) {
  const idFuente = `${PREFIJO_CAPA_WMS}src-${capa.id}`
  const idCapa   = `${PREFIJO_CAPA_WMS}${capa.id}`

  // Evita duplicar la capa si ya fue agregada
  if (mapa.getLayer(idCapa)) return

  // Determina el endpoint WMS y el nombre de la capa
  const esExterna = !capa.tabla_origen
  const endpointWms = esExterna ? capa.url_wms : `${geoserverUrl}/wms`
  const nombreCapaWMS = capa.nombre_capa_wms ?? capa.nombre_interno

  const urlTiles = construirUrlWMS(endpointWms, nombreCapaWMS)

  console.log(
    `[WMS] Capa "${capa.nombre ?? capa.nombre_interno}" | LAYERS=${nombreCapaWMS}\n` +
    `      URL template: ${urlTiles}`
  )

  // Agrega la fuente raster
  if (!mapa.getSource(idFuente)) {
    mapa.addSource(idFuente, {
      type: 'raster',
      tiles: [urlTiles],
      tileSize: 256,
      attribution: capa.atribucion ?? '',
    })
  }

  // Agrega la capa raster sobre el mapa base
  mapa.addLayer({
    id: idCapa,
    type: 'raster',
    source: idFuente,
    paint: {
      'raster-opacity': capa.opacidad ?? 1,
    },
    layout: {
      visibility: 'visible',
    },
  })
}

/**
 * Elimina una capa WMS del mapa por su ID.
 * Si la capa no existe, no hace nada.
 *
 * @param {maplibregl.Map} mapa   - Instancia del mapa
 * @param {string}         capaId - ID de la capa (sin prefijo)
 */
export function quitarCapa(mapa, capaId) {
  const idFuente = `${PREFIJO_CAPA_WMS}src-${capaId}`
  const idCapa   = `${PREFIJO_CAPA_WMS}${capaId}`

  if (mapa.getLayer(idCapa)) {
    mapa.removeLayer(idCapa)
  }
  if (mapa.getSource(idFuente)) {
    mapa.removeSource(idFuente)
  }
}

/**
 * Sincroniza las capas WMS activas en el mapa.
 * Agrega las que faltan y elimina las que ya no están activas.
 *
 * @param {maplibregl.Map} mapa          - Instancia del mapa
 * @param {Array}          capasActivas  - Lista de objetos capa activos
 * @param {string}         geoserverUrl  - URL base del GeoServer
 */
export function sincronizarCapas(mapa, capasActivas, geoserverUrl) {
  if (!mapa || !mapa.loaded()) return

  // IDs de capas que deberían estar visibles
  const idsActivos = new Set(capasActivas.map((c) => `${PREFIJO_CAPA_WMS}${c.id}`))

  // Obtiene todas las capas WMS actualmente en el mapa
  const capasActuales = mapa
    .getStyle()
    .layers.filter((l) => l.id.startsWith(PREFIJO_CAPA_WMS))
    .map((l) => l.id)

  // Elimina las capas que ya no están activas
  for (const idCapa of capasActuales) {
    if (!idsActivos.has(idCapa)) {
      const capaId = idCapa.replace(PREFIJO_CAPA_WMS, '')
      quitarCapa(mapa, capaId)
    }
  }

  // Agrega las capas activas que faltan y actualiza opacidades
  for (const capa of capasActivas) {
    const idCapa = `${PREFIJO_CAPA_WMS}${capa.id}`
    if (!mapa.getLayer(idCapa)) {
      agregarCapaWMS(mapa, capa, geoserverUrl)
    } else {
      // Actualiza opacidad si la capa ya existe
      mapa.setPaintProperty(idCapa, 'raster-opacity', capa.opacidad ?? 1)
    }
  }
}

/**
 * Agrega o actualiza la capa de resaltado de un predio en el mapa.
 * Usa una fuente GeoJSON para mostrar el polígono del predio seleccionado.
 *
 * @param {maplibregl.Map} mapa    - Instancia del mapa
 * @param {object}         geojson - Feature GeoJSON (Polygon/MultiPolygon)
 */
export function resaltarPredioEnMapa(mapa, geojson) {
  const ID_FUENTE  = 'predio-resaltado'
  const ID_RELLENO = 'predio-relleno'
  const ID_BORDE   = 'predio-borde'

  // Si la fuente existe, actualiza sus datos
  if (mapa.getSource(ID_FUENTE)) {
    mapa.getSource(ID_FUENTE).setData(geojson)
    return
  }

  // Crea la fuente GeoJSON
  mapa.addSource(ID_FUENTE, {
    type: 'geojson',
    data: geojson,
  })

  // Capa de relleno semitransparente
  mapa.addLayer({
    id: ID_RELLENO,
    type: 'fill',
    source: ID_FUENTE,
    paint: {
      'fill-color': '#2563eb',
      'fill-opacity': 0.25,
    },
  })

  // Capa de borde sólido
  mapa.addLayer({
    id: ID_BORDE,
    type: 'line',
    source: ID_FUENTE,
    paint: {
      'line-color': '#1d4ed8',
      'line-width': 2,
    },
  })
}

/**
 * Elimina el resaltado del predio del mapa.
 * @param {maplibregl.Map} mapa - Instancia del mapa
 */
export function limpiarResaltadoEnMapa(mapa) {
  const ID_FUENTE  = 'predio-resaltado'
  const ID_RELLENO = 'predio-relleno'
  const ID_BORDE   = 'predio-borde'

  if (mapa.getLayer(ID_BORDE))   mapa.removeLayer(ID_BORDE)
  if (mapa.getLayer(ID_RELLENO)) mapa.removeLayer(ID_RELLENO)
  if (mapa.getSource(ID_FUENTE)) mapa.removeSource(ID_FUENTE)
}
