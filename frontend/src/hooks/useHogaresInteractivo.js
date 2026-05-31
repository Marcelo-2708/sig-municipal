/**
 * useHogaresInteractivo.js
 *
 * - Carga hogares por WFS (solo campos necesarios)
 * - Dibuja polígonos coloreados por n_hog
 * - Dibuja puntos azules en centroides de manzanas con datos
 * - Al hacer click abre el PanelCensalHogares vía mapaStore
 */
import { useEffect } from 'react'
import useMapaStore  from '../store/mapaStore.js'

const SRC_POLY  = 'hog-src-poly'
const SRC_PTS   = 'hog-src-pts'
const LYR_POLY  = 'hog-poly'
const LYR_BORDE = 'hog-borde'
const LYR_PTS   = 'hog-pts'

// Centroide aproximado de un polígono GeoJSON
function centroide(geom) {
  if (geom.type === 'Point') return geom.coordinates
  const anillo = geom.type === 'Polygon'
    ? geom.coordinates[0]
    : geom.coordinates.reduce((a, b) => a[0].length >= b[0].length ? a : b)[0]
  return [
    anillo.reduce((s, c) => s + c[0], 0) / anillo.length,
    anillo.reduce((s, c) => s + c[1], 0) / anillo.length,
  ]
}

export function useHogaresInteractivo(mapa, capasActivas, geoserverUrl) {
  const setManzanaSeleccionada = useMapaStore((s) => s.setManzanaSeleccionada)
  const setClickBloqueado      = useMapaStore((s) => s.setClickBloqueado)
  const hogaresActiva = capasActivas.some((c) => c.nombre_interno === 'hogares')

  useEffect(() => {
    if (!mapa || !hogaresActiva) return

    let cancelado = false

    const limpiar = () => {
      for (const id of [LYR_PTS, LYR_BORDE, LYR_POLY]) {
        if (mapa.getLayer(id)) mapa.removeLayer(id)
      }
      if (mapa.getSource(SRC_PTS))  mapa.removeSource(SRC_PTS)
      if (mapa.getSource(SRC_POLY)) mapa.removeSource(SRC_POLY)
      setManzanaSeleccionada(null)
    }

    const CAMPOS = 'wkb_geometry,n_hog,n_per,n_hombres,n_mujeres,prom_edad,prom_escol,localidad'
    const url =
      `${geoserverUrl}/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
      `&TYPENAMES=vichuquen:hogares&OUTPUTFORMAT=application/json` +
      `&PROPERTYNAME=${CAMPOS}`

    const inicializar = () => {
      if (cancelado) return

      fetch(url)
        .then((r) => { if (!r.ok) throw new Error('WFS ' + r.status); return r.json() })
        .then((geojson) => {
          if (cancelado) return

          const todos    = geojson.features ?? []
          const conDatos = todos.filter((f) => (f.properties?.n_hog ?? 0) > 0)

          // GeoJSON de puntos (centroides de manzanas con datos)
          const puntosGJ = {
            type: 'FeatureCollection',
            features: conDatos.map((f, i) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: centroide(f.geometry) },
              properties: { ...f.properties, _num: i + 1 },
            })),
          }

          limpiar()
          setManzanaSeleccionada(null)

          // Fuentes
          mapa.addSource(SRC_POLY, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: todos },
          })
          mapa.addSource(SRC_PTS, { type: 'geojson', data: puntosGJ })

          // Polígonos coloreados por rango n_hog
          mapa.addLayer({
            id: LYR_POLY, type: 'fill', source: SRC_POLY,
            paint: {
              'fill-color': [
                'case',
                ['<=', ['get', 'n_hog'], 0],    'rgba(0,0,0,0)',
                ['<=', ['get', 'n_hog'], 4],    '#ffe4e6',
                ['<=', ['get', 'n_hog'], 9],    '#fca5a5',
                ['<=', ['get', 'n_hog'], 16],   '#ef4444',
                '#b91c1c',
              ],
              'fill-opacity': ['case', ['<=', ['get', 'n_hog'], 0], 0, 0.50],
            },
          })

          // Bordes
          mapa.addLayer({
            id: LYR_BORDE, type: 'line', source: SRC_POLY,
            paint: {
              'line-color': '#e4708b',
              'line-width': 1,
              'line-opacity': ['case', ['<=', ['get', 'n_hog'], 0], 0, 0.70],
            },
          })

          // Puntos azules en centroides
          mapa.addLayer({
            id: LYR_PTS, type: 'circle', source: SRC_PTS,
            paint: {
              'circle-radius': [
                'case',
                ['<=', ['get', 'n_hog'], 4],  8,
                ['<=', ['get', 'n_hog'], 9],  12,
                ['<=', ['get', 'n_hog'], 16], 16,
                22,
              ],
              'circle-color': '#1a56db',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          })

          // Click en punto azul → bloquea GFI y abre panel censal
          mapa.on('click', LYR_PTS, (e) => {
            e.preventDefault()
            setClickBloqueado(true)
            const f = e.features[0]
            setManzanaSeleccionada({ ...f.properties, _x: e.point.x, _y: e.point.y })
          })

          // Click en polígono con datos (si no hay punto encima)
          mapa.on('click', LYR_POLY, (e) => {
            const sobrePunto = mapa.queryRenderedFeatures(e.point, { layers: [LYR_PTS] })
            if (sobrePunto.length) return
            const f = e.features[0]
            if ((f.properties?.n_hog ?? 0) <= 0) return
            setClickBloqueado(true)
            const num = conDatos.findIndex(
              (c) =>
                c.properties?.n_hog     === f.properties?.n_hog &&
                c.properties?.localidad === f.properties?.localidad
            ) + 1
            setManzanaSeleccionada({ ...f.properties, _num: num || '?', _x: e.point.x, _y: e.point.y })
          })

          // Cursors
          mapa.on('mouseenter', LYR_PTS,  () => { mapa.getCanvas().style.cursor = 'pointer' })
          mapa.on('mouseleave', LYR_PTS,  () => { mapa.getCanvas().style.cursor = '' })
          mapa.on('mouseenter', LYR_POLY, (e) => {
            if ((e.features[0]?.properties?.n_hog ?? 0) > 0)
              mapa.getCanvas().style.cursor = 'pointer'
          })
          mapa.on('mouseleave', LYR_POLY, () => { mapa.getCanvas().style.cursor = '' })
        })
        .catch((err) => console.error('[useHogaresInteractivo]', err))
    }

    if (mapa.loaded()) inicializar()
    else mapa.once('load', inicializar)

    return () => {
      cancelado = true
      limpiar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, hogaresActiva, geoserverUrl])
}
