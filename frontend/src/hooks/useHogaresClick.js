/**
 * useHogaresClick.js
 * Registra la capa GeoJSON de hogares en MapLibre y maneja el click
 * para seleccionar un poligono con n_hog > 0.
 *
 * Coloca en: frontend/src/hooks/useHogaresClick.js
 */
import { useEffect, useState, useRef } from 'react'

const ID_FUENTE   = 'hogares-geojson'
const ID_RELLENO  = 'hogares-relleno'
const ID_BORDE    = 'hogares-borde'
const ID_RESALTE  = 'hogares-resalte'

export function useHogaresClick(mapa, features) {
  const [seleccionado, setSeleccionado] = useState(null)
  const featuresRef = useRef(features)

  // Actualizar ref cuando cambian features
  useEffect(() => { featuresRef.current = features }, [features])

  useEffect(() => {
    if (!mapa || !features.length) return

    // Filtrar solo manzanas con datos (n_hog > 0)
    const conDatos = {
      type: 'FeatureCollection',
      features: features.filter((f) => (f.properties?.n_hog ?? 0) > 0),
    }

    const sinDatos = {
      type: 'FeatureCollection',
      features: features.filter((f) => (f.properties?.n_hog ?? 0) <= 0),
    }

    const agregar = () => {
      // Limpiar si ya existian
      for (const id of [ID_RESALTE, ID_BORDE, ID_RELLENO]) {
        if (mapa.getLayer(id)) mapa.removeLayer(id)
      }
      if (mapa.getSource(ID_FUENTE)) mapa.removeSource(ID_FUENTE)

      // Fuente GeoJSON con todos los features
      mapa.addSource(ID_FUENTE, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: features,
        },
      })

      // Relleno: con datos = semi-transparente segun rango n_hog, sin datos = invisible
      mapa.addLayer({
        id: ID_RELLENO,
        type: 'fill',
        source: ID_FUENTE,
        paint: {
          'fill-color': [
            'case',
            ['<=', ['get', 'n_hog'], 0],   'transparent',
            ['<=', ['get', 'n_hog'], 2],   '#ffffff',
            ['<=', ['get', 'n_hog'], 9],   '#ffaaaa',
            ['<=', ['get', 'n_hog'], 16.5],'#ff5555',
            '#ff0000',
          ],
          'fill-opacity': [
            'case',
            ['<=', ['get', 'n_hog'], 0], 0,
            0.46,
          ],
        },
      })

      // Borde solo para manzanas con datos
      mapa.addLayer({
        id: ID_BORDE,
        type: 'line',
        source: ID_FUENTE,
        paint: {
          'line-color': '#e4708b',
          'line-width': 1,
          'line-opacity': [
            'case',
            ['<=', ['get', 'n_hog'], 0], 0,
            0.7,
          ],
        },
      })

      // Capa de resalte (seleccion) - inicialmente sin datos
      mapa.addLayer({
        id: ID_RESALTE,
        type: 'line',
        source: ID_FUENTE,
        paint: {
          'line-color': '#1a56db',
          'line-width': 3,
          'line-opacity': 1,
        },
        filter: ['==', ['id'], -1],  // ocultar todo al inicio
      })

      // Cursor pointer al hover
      mapa.on('mouseenter', ID_RELLENO, (e) => {
        const nHog = e.features?.[0]?.properties?.n_hog ?? 0
        if (nHog > 0) mapa.getCanvas().style.cursor = 'pointer'
      })
      mapa.on('mouseleave', ID_RELLENO, () => {
        mapa.getCanvas().style.cursor = ''
      })

      // Click para seleccionar
      mapa.on('click', ID_RELLENO, (e) => {
        const feature = e.features?.[0]
        if (!feature) return
        const nHog = feature.properties?.n_hog ?? 0
        if (nHog <= 0) return

        // Resaltar borde de la manzana seleccionada
        mapa.setFilter(ID_RESALTE, ['==', ['get', 'n_hog'], nHog])

        // Buscar el feature completo en la lista original (con todas las props)
        const completo = featuresRef.current.find(
          (f) => f.properties?.n_hog === nHog && f.properties?.localidad === feature.properties?.localidad
        ) ?? feature

        setSeleccionado(completo)
      })
    }

    if (mapa.loaded()) {
      agregar()
    } else {
      mapa.once('load', agregar)
    }

    return () => {
      mapa.off('click', ID_RELLENO, () => {})
      mapa.off('mouseenter', ID_RELLENO, () => {})
      mapa.off('mouseleave', ID_RELLENO, () => {})
      for (const id of [ID_RESALTE, ID_BORDE, ID_RELLENO]) {
        if (mapa.getLayer(id)) mapa.removeLayer(id)
      }
      if (mapa.getSource(ID_FUENTE)) mapa.removeSource(ID_FUENTE)
    }
  }, [mapa, features])

  const limpiar = () => {
    setSeleccionado(null)
    if (mapa && mapa.getLayer(ID_RESALTE)) {
      mapa.setFilter(ID_RESALTE, ['==', ['id'], -1])
    }
  }

  return { seleccionado, limpiar }
}
