/**
 * Estilos de mapa base disponibles para el selector de capas.
 * Cada entrada define el nombre visible, la URL del estilo y una descripción.
 *
 * Se usa EPSG:3857 (Web Mercator) en las URLs WMS pero las coordenadas
 * de la aplicación siempre se manejan en WGS84 (EPSG:4326).
 */

// Centro por defecto en Chile continental
export const CENTRO_INICIAL = [-70.6483, -33.4569] // Santiago, Chile
export const ZOOM_INICIAL = 12

export const MAPAS_BASE = {
  calles: {
    id: 'calles',
    nombre: 'Calles',
    descripcion: 'Mapa de calles claro (Carto Positron)',
    icono: '🗺️',
    estilo: {
      version: 8,
      sources: {
        'carto-positron': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxzoom: 20,
        },
      },
      layers: [
        {
          id: 'carto-positron-layer',
          type: 'raster',
          source: 'carto-positron',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },

  satelite: {
    id: 'satelite',
    nombre: 'Satélite',
    descripcion: 'Imágenes satelitales (ESRI World Imagery)',
    icono: '🛰️',
    estilo: {
      version: 8,
      sources: {
        'esri-satelite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution:
            'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          maxzoom: 20,
        },
      },
      layers: [
        {
          id: 'esri-satelite-layer',
          type: 'raster',
          source: 'esri-satelite',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },

  oscuro: {
    id: 'oscuro',
    nombre: 'Oscuro',
    descripcion: 'Mapa oscuro (Carto Dark Matter)',
    icono: '🌑',
    estilo: {
      version: 8,
      sources: {
        'carto-dark': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxzoom: 20,
        },
      },
      layers: [
        {
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
  },
}

// ID del mapa base que se carga por defecto
export const MAPA_BASE_DEFECTO = 'calles'
