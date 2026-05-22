/**
 * Componente de mapa base.
 * Inicializa MapLibre GL JS una única vez (guard con useRef).
 * Sincroniza las capas WMS activas y expone la referencia al store.
 * El fondo cartográfico es fijo (OSM Mapnik), definido en config/mapas.js.
 */

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

import useMapaStore from '../../store/mapaStore.js'
import { ESTILO_MAPA_BASE, CENTRO_INICIAL, ZOOM_INICIAL } from '../../config/mapas.js'
import { sincronizarCapas } from '../../services/mapaUtils.js'
import { GEOSERVER_URL } from '../../config/api.js'

/**
 * @param {object} props
 * @param {Array}  props.capasActivas - Lista de capas WMS que deben estar visibles
 */
function MapaBase({ capasActivas = [] }) {
  const contenedorRef   = useRef(null)
  const inicializadoRef = useRef(false)

  const setMapaRef  = useMapaStore((s) => s.setMapaRef)
  const limpiarMapa = useMapaStore((s) => s.limpiarMapa)
  const mapaRef     = useMapaStore((s) => s.mapaRef)

  // ── Inicialización del mapa ─────────────────────────────────────────────
  useEffect(() => {
    if (inicializadoRef.current || !contenedorRef.current) return
    inicializadoRef.current = true

    const mapa = new maplibregl.Map({
      container: contenedorRef.current,
      style: ESTILO_MAPA_BASE,
      center: CENTRO_INICIAL,
      zoom: ZOOM_INICIAL,
      attributionControl: false,
      trackResize: true,
    })

    mapa.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      'bottom-right'
    )

    mapa.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'bottom-right'
    )

    mapa.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-left'
    )

    mapa.on('load', () => {
      setMapaRef(mapa)
    })

    return () => {
      mapa.remove()
      limpiarMapa()
      inicializadoRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sincronización de capas WMS ─────────────────────────────────────────
  useEffect(() => {
    if (!mapaRef || !mapaRef.loaded()) return
    sincronizarCapas(mapaRef, capasActivas, GEOSERVER_URL)
  }, [capasActivas, mapaRef])

  return (
    <div
      ref={contenedorRef}
      className="contenedor-mapa"
      aria-label="Mapa interactivo del municipio"
      role="application"
    />
  )
}

export default MapaBase
