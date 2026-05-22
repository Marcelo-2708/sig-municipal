/**
 * Configuración del mapa.
 * El fondo cartográfico es fijo (OpenStreetMap Mapnik) y no seleccionable por el usuario.
 * El centro y zoom iniciales apuntan al área del proyecto (Concepción, Biobío).
 */

// Centro calculado desde el bbox del proyecto QGISCloud (EPSG:3857 → WGS84)
// bbox 3857: -8139044, -4411300, -8133964, -4408662  → Concepción, Biobío
export const CENTRO_INICIAL = [-73.12, -36.633]
export const ZOOM_INICIAL = 14

// Estilo MapLibre con OpenStreetMap Mapnik como único fondo
export const ESTILO_MAPA_BASE = {
  version: 8,
  sources: {
    'osm-mapnik': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-mapnik-layer',
      type: 'raster',
      source: 'osm-mapnik',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
}
