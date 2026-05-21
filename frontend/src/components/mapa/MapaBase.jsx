/**
 * Componente de mapa base.
 * Inicializa MapLibre GL JS una única vez (guard con useRef).
 * Sincroniza las capas WMS activas y expone la referencia al store.
 */

import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

import useMapaStore from '../../store/mapaStore.js'
import { MAPAS_BASE, CENTRO_INICIAL, ZOOM_INICIAL, MAPA_BASE_DEFECTO } from '../../config/mapas.js'
import { sincronizarCapas } from '../../services/mapaUtils.js'
import { GEOSERVER_URL } from '../../config/api.js'

/**
 * @param {object} props
 * @param {Array}  props.capasActivas - Lista de capas WMS que deben estar visibles
 */
function MapaBase({ capasActivas = [] }) {
  // Referencia al nodo DOM del contenedor del mapa
  const contenedorRef = useRef(null)

  // Guard: evita inicializar el mapa más de una vez
  const inicializadoRef = useRef(false)

  const setMapaRef  = useMapaStore((s) => s.setMapaRef)
  const limpiarMapa = useMapaStore((s) => s.limpiarMapa)
  const mapaBaseActivo = useMapaStore((s) => s.mapaBaseActivo)

  // ── Inicialización del mapa ─────────────────────────────────────────────
  useEffect(() => {
    // Guard: no inicializar dos veces
    if (inicializadoRef.current || !contenedorRef.current) return
    inicializadoRef.current = true

    const estiloInicial = MAPAS_BASE[mapaBaseActivo]?.estilo
      ?? MAPAS_BASE[MAPA_BASE_DEFECTO].estilo

    const mapa = new maplibregl.Map({
      container: contenedorRef.current,
      style: estiloInicial,
      center: CENTRO_INICIAL,
      zoom: ZOOM_INICIAL,
      attributionControl: false,
      // Mejora el rendimiento en móviles
      trackResize: true,
    })

    // Controles de navegación (zoom + rotación)
    mapa.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      'bottom-right'
    )

    // Control de geolocalización del usuario
    mapa.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'bottom-right'
    )

    // Atribución personalizada
    mapa.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-left'
    )

    // Guarda la referencia en el store al terminar de cargar
    mapa.on('load', () => {
      setMapaRef(mapa)
    })

    // Cleanup al desmontar el componente
    return () => {
      mapa.remove()
      limpiarMapa()
      inicializadoRef.current = false
    }
    // Solo se ejecuta al montar (intencional)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cambio de mapa base ─────────────────────────────────────────────────
  const mapaRef = useMapaStore((s) => s.mapaRef)

  useEffect(() => {
    if (!mapaRef) return
    const nuevoEstilo = MAPAS_BASE[mapaBaseActivo]?.estilo
    if (!nuevoEstilo) return

    // setStyle preserva las capas personalizadas si se usa el hook correcto;
    // por simplicidad recargamos el estilo completo
    mapaRef.setStyle(nuevoEstilo)

    // Después de cambiar el estilo, re-agrega las capas WMS
    mapaRef.once('style.load', () => {
      sincronizarCapas(mapaRef, capasActivas, GEOSERVER_URL)
    })
  }, [mapaBaseActivo, mapaRef])

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
