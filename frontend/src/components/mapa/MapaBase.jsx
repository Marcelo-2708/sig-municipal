/**
 * MapaBase.jsx
 * Inicializa MapLibre GL JS, sincroniza capas WMS y activa
 * la interactividad de hogares (puntos + popup censal).
 */
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

import useMapaStore from '../../store/mapaStore.js'
import { CENTRO_INICIAL, ZOOM_INICIAL, resolverEstiloFondo } from '../../config/mapas.js'
import { sincronizarCapas } from '../../services/mapaUtils.js'
import { GEOSERVER_URL } from '../../config/api.js'
import { useHogaresInteractivo } from '../../hooks/useHogaresInteractivo.js'

function MapaBase({ capasActivas = [], configMapa }) {
  const contenedorRef   = useRef(null)
  const inicializadoRef = useRef(false)

  const setMapaRef  = useMapaStore((s) => s.setMapaRef)
  const limpiarMapa = useMapaStore((s) => s.limpiarMapa)
  const mapaRef     = useMapaStore((s) => s.mapaRef)

  // Puntos azules + popup censal en manzanas hogares
  useHogaresInteractivo(mapaRef, capasActivas, GEOSERVER_URL)

  // -- Inicializacion ----------------------------------------------------------
  useEffect(() => {
    if (inicializadoRef.current || !contenedorRef.current) return
    inicializadoRef.current = true

    const estilo = resolverEstiloFondo(configMapa?.fondo)
    const centro = configMapa?.centro ?? CENTRO_INICIAL
    const zoom   = configMapa?.zoom   ?? ZOOM_INICIAL

    const mapa = new maplibregl.Map({
      container: contenedorRef.current,
      style: estilo,
      center: centro,
      zoom: zoom,
      attributionControl: false,
      trackResize: true,
    })

    mapa.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right')
    mapa.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), 'bottom-right')
    mapa.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    mapa.on('load', () => setMapaRef(mapa))

    return () => {
      mapa.remove()
      limpiarMapa()
      inicializadoRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -- Sincronizacion capas WMS ------------------------------------------------
  useEffect(() => {
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
