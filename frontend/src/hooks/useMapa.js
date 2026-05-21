/**
 * Hook para interactuar con el mapa MapLibre.
 * Provee acciones sobre el mapa usando la referencia almacenada en mapaStore.
 */

import { useCallback } from 'react'
import useMapaStore from '../store/mapaStore.js'
import {
  resaltarPredioEnMapa,
  limpiarResaltadoEnMapa,
} from '../services/mapaUtils.js'

/**
 * @returns {{
 *   mapa: maplibregl.Map|null,
 *   estaListo: boolean,
 *   volarA: (lng: number, lat: number, zoom?: number) => void,
 *   resaltarPredio: (geojson: object) => void,
 *   limpiarResaltado: () => void,
 *   centroActual: [number, number],
 *   zoomActual: number,
 * }}
 */
function useMapa() {
  const mapaRef        = useMapaStore((s) => s.mapaRef)
  const centroActual   = useMapaStore((s) => s.centroActual)
  const zoomActual     = useMapaStore((s) => s.zoomActual)
  const setCentro      = useMapaStore((s) => s.setCentro)
  const setZoom        = useMapaStore((s) => s.setZoom)
  const setPredioResaltado = useMapaStore((s) => s.setPredioResaltado)

  // El mapa está listo cuando la referencia existe
  const estaListo = Boolean(mapaRef)

  /**
   * Vuela animadamente a las coordenadas indicadas.
   * @param {number} lng  - Longitud (WGS84)
   * @param {number} lat  - Latitud (WGS84)
   * @param {number} [zoom=16] - Nivel de zoom destino
   */
  const volarA = useCallback(
    (lng, lat, zoom = 16) => {
      if (!mapaRef) return
      mapaRef.flyTo({
        center: [lng, lat],
        zoom,
        duration: 1200,
        essential: true,
      })
      setCentro([lng, lat])
      setZoom(zoom)
    },
    [mapaRef, setCentro, setZoom]
  )

  /**
   * Resalta un predio en el mapa mostrando su polígono.
   * @param {object} geojson - Feature GeoJSON del predio
   */
  const resaltarPredio = useCallback(
    (geojson) => {
      if (!mapaRef) return
      resaltarPredioEnMapa(mapaRef, geojson)
      setPredioResaltado(geojson)

      // Si el GeoJSON tiene geometría, centra el mapa en él
      if (geojson?.geometry?.coordinates) {
        try {
          // Calcula el centroide aproximado del polígono (primer anillo exterior)
          const coords = geojson.geometry.type === 'Polygon'
            ? geojson.geometry.coordinates[0]
            : geojson.geometry.coordinates[0][0]

          if (coords && coords.length > 0) {
            const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length
            const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
            volarA(lng, lat, 17)
          }
        } catch {
          // Si el cálculo del centroide falla, no hace nada
        }
      }
    },
    [mapaRef, setPredioResaltado, volarA]
  )

  /**
   * Elimina el resaltado del predio del mapa.
   */
  const limpiarResaltado = useCallback(() => {
    if (!mapaRef) return
    limpiarResaltadoEnMapa(mapaRef)
    setPredioResaltado(null)
  }, [mapaRef, setPredioResaltado])

  return {
    mapa: mapaRef,
    estaListo,
    volarA,
    resaltarPredio,
    limpiarResaltado,
    centroActual,
    zoomActual,
  }
}

export default useMapa
