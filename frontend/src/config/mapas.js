/**
 * Configuración del mapa.
 * El fondo cartográfico se define por tenant vía municipios.config.mapa.fondo.
 * Los valores por defecto apuntan al área del proyecto demo (Concepción, Biobío).
 */

// Valores por defecto usados cuando el tenant no define configuración propia
export const CENTRO_INICIAL = [-73.12, -36.633]
export const ZOOM_INICIAL = 14

// Fondos cartográficos disponibles
export const FONDOS_MAPA = {
  // OpenStreetMap Mapnik (por defecto)
  osm: {
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
    layers: [{ id: 'osm-mapnik-layer', type: 'raster', source: 'osm-mapnik', minzoom: 0, maxzoom: 22 }],
  },

  // ESRI World Imagery (satélite)
  esri_imagery: {
    version: 8,
    sources: {
      'esri-imagery': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxzoom: 18,
      },
    },
    layers: [{ id: 'esri-imagery-layer', type: 'raster', source: 'esri-imagery', minzoom: 0, maxzoom: 22 }],
  },
}

// Fondo por defecto (OSM) — alias para compatibilidad con importaciones existentes
export const ESTILO_MAPA_BASE = FONDOS_MAPA.osm

/**
 * Retorna el estilo MapLibre correspondiente al identificador de fondo.
 * Si el identificador no existe, retorna OSM como fallback.
 * @param {string|undefined} idFondo - Clave de FONDOS_MAPA (ej: "esri_imagery")
 * @returns {object} Objeto de estilo MapLibre
 */
export function resolverEstiloFondo(idFondo) {
  return FONDOS_MAPA[idFondo] ?? FONDOS_MAPA.osm
}
