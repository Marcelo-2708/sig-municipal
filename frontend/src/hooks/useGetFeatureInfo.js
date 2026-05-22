/**
 * Hook que intercepta clicks en el mapa y consulta WMS GetFeatureInfo
 * para todas las capas WMS activas (tanto GeoServer local como externas).
 */

import { useState, useEffect, useCallback } from 'react'
import useMapaStore from '../store/mapaStore.js'
import { GEOSERVER_URL } from '../config/api.js'

/**
 * Convierte coordenadas WGS84 a EPSG:3857 (Web Mercator).
 */
function lngLatAMercator(lng, lat) {
  const R = 6378137
  const x = R * (lng * Math.PI / 180)
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2))
  return [x, y]
}

/**
 * Construye y ejecuta una petición WMS GetFeatureInfo.
 * El query string se construye como string literal (no URLSearchParams) para
 * evitar que ":" en nombres de capas GeoServer ("demo:capa") se codifique como "%3A".
 *
 * @param {string}              endpointWms - URL completa del endpoint WMS
 * @param {string}              nombreCapa  - Nombre de la capa (ej: "demo:inacap_ccp_thno")
 * @param {maplibregl.Map}      mapa
 * @param {maplibregl.LngLat}   lngLat      - Punto clicado
 * @returns {Promise<GeoJSON.Feature[]|null>}
 */
async function consultarFeatureInfo(endpointWms, nombreCapa, mapa, lngLat) {
  const canvas = mapa.getCanvas()
  const ancho  = canvas.clientWidth
  const alto   = canvas.clientHeight

  const pixel = mapa.project(lngLat)
  const x = Math.round(pixel.x)
  const y = Math.round(pixel.y)

  const bounds = mapa.getBounds()
  const [minx, miny] = lngLatAMercator(bounds.getWest(), bounds.getSouth())
  const [maxx, maxy] = lngLatAMercator(bounds.getEast(), bounds.getNorth())
  const bbox = `${minx},${miny},${maxx},${maxy}`

  // String literal: evita que URLSearchParams codifique ":" → "%3A"
  const qs =
    `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo` +
    `&LAYERS=${nombreCapa}&QUERY_LAYERS=${nombreCapa}` +
    `&INFO_FORMAT=application/json&FEATURE_COUNT=10` +
    `&X=${x}&Y=${y}&WIDTH=${ancho}&HEIGHT=${alto}` +
    `&BBOX=${bbox}&SRS=EPSG:3857`

  const resp = await fetch(`${endpointWms}?${qs}`, {
    signal: AbortSignal.timeout(8000),
  })

  if (!resp.ok) return null

  const tipo = resp.headers.get('content-type') ?? ''
  if (!tipo.includes('json')) return null

  const data = await resp.json()
  const features = data?.features ?? []
  return features.length > 0 ? features : null
}

/**
 * Determina el endpoint WMS correcto para una capa:
 * - GeoServer local (tabla_origen != ''): usa GEOSERVER_URL del entorno (accesible desde browser)
 * - WMS externa (tabla_origen == ''): usa capa.url_wms directamente
 */
function endpointParaCapa(capa) {
  const esGeoServerLocal = Boolean(capa.tabla_origen)
  return esGeoServerLocal ? `${GEOSERVER_URL}/wms` : capa.url_wms
}

/**
 * @param {Array} capasActivas - Lista de capas actualmente visibles en el mapa
 * @returns {{
 *   resultados: Array<{capa: object, features: Array}>|null,
 *   cargando: boolean,
 *   error: string|null,
 *   cerrar: () => void,
 * }}
 */
export function useGetFeatureInfo(capasActivas) {
  const mapaRef = useMapaStore((s) => s.mapaRef)

  const [resultados, setResultados] = useState(null)
  const [cargando,   setCargando]   = useState(false)
  const [error,      setError]      = useState(null)

  const cerrar = useCallback(() => {
    setResultados(null)
    setError(null)
  }, [])

  useEffect(() => {
    if (!mapaRef) return

    const handler = async (e) => {
      // Consulta todas las capas WMS activas que tengan URL configurada
      const capasConsultables = capasActivas.filter((c) => c.url_wms || c.tabla_origen)
      if (capasConsultables.length === 0) return

      setCargando(true)
      setResultados(null)
      setError(null)
      mapaRef.getCanvas().style.cursor = 'wait'

      try {
        const promesas = capasConsultables.map((capa) => {
          const endpoint   = endpointParaCapa(capa)
          const nombreCapa = capa.nombre_capa_wms ?? capa.nombre_interno
          return consultarFeatureInfo(endpoint, nombreCapa, mapaRef, e.lngLat)
            .then((features) => (features ? { capa, features } : null))
            .catch(() => null)
        })

        const todos = (await Promise.all(promesas)).filter(Boolean)
        setResultados(todos.length > 0 ? todos : null)
        if (todos.length === 0) {
          setError('No se encontraron elementos en este punto.')
        }
      } catch {
        setError('No se pudo consultar la información de las capas.')
      } finally {
        setCargando(false)
        mapaRef.getCanvas().style.cursor = ''
      }
    }

    mapaRef.on('click', handler)
    return () => mapaRef.off('click', handler)
  }, [mapaRef, capasActivas])

  return { resultados, cargando, error, cerrar }
}
