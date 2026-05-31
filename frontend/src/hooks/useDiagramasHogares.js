/**
 * useDiagramasHogares.js
 * Dibuja graficos de torta como markers MapLibre usando canvas HTML.
 * Coloca en: frontend/src/hooks/useDiagramasHogares.js
 */
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

const COLOR_HOMBRES = '#1565C0'
const COLOR_MUJERES = '#E91E8C'
const COLOR_BORDE   = '#FFFFFF'

function diametroPorHog(nHog) {
  if (nHog <= 2)    return 24
  if (nHog <= 9)    return 40
  if (nHog <= 16.5) return 58
  return 80
}

function crearCanvasTorta(hombres, mujeres, diametro) {
  const tam    = diametro + 4
  const canvas = document.createElement('canvas')
  canvas.width  = tam
  canvas.height = tam
  canvas.style.display = 'block'

  const ctx = canvas.getContext('2d')
  const cx  = tam / 2
  const cy  = tam / 2
  const r   = diametro / 2

  const total = (hombres + mujeres) || 1
  const propH = hombres / total
  const inicio = -Math.PI / 2
  const finH   = inicio + propH * 2 * Math.PI

  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, r, inicio, finH)
  ctx.closePath()
  ctx.fillStyle = COLOR_HOMBRES
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.arc(cx, cy, r, finH, inicio + 2 * Math.PI)
  ctx.closePath()
  ctx.fillStyle = COLOR_MUJERES
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, 2 * Math.PI)
  ctx.strokeStyle = COLOR_BORDE
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + r * Math.cos(inicio), cy + r * Math.sin(inicio))
  ctx.strokeStyle = COLOR_BORDE
  ctx.lineWidth = 1.5
  ctx.stroke()

  if (Math.abs(propH - 0.5) > 0.01) {
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + r * Math.cos(finH), cy + r * Math.sin(finH))
    ctx.strokeStyle = COLOR_BORDE
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  return canvas
}

function centroide(geom) {
  if (geom.type === 'Point') return geom.coordinates
  let anillo
  if (geom.type === 'Polygon') {
    anillo = geom.coordinates[0]
  } else {
    anillo = geom.coordinates.reduce((a, b) =>
      a[0].length >= b[0].length ? a : b
    )[0]
  }
  const lng = anillo.reduce((s, c) => s + c[0], 0) / anillo.length
  const lat = anillo.reduce((s, c) => s + c[1], 0) / anillo.length
  return [lng, lat]
}

async function fetchHogaresWFS(geoserverUrl) {
  const url =
    `${geoserverUrl}/wfs` +
    `?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
    `&TYPENAMES=vichuquen:hogares` +
    `&OUTPUTFORMAT=application/json` +
    `&PROPERTYNAME=wkb_geometry,n_hog,n_hombres,n_mujeres`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`WFS error ${res.status}`)
  return res.json()
}

function dibujarMarkers(mapa, geojson, markersRef) {
  for (const m of markersRef.current) m.remove()
  markersRef.current = []

  const features = geojson.features ?? []
  console.log(`[useDiagramasHogares] Dibujando ${features.length} markers`)

  for (const feature of features) {
    const { n_hog = 0, n_hombres = 0, n_mujeres = 0 } = feature.properties ?? {}
    if (n_hog <= 0) continue

    const coords   = centroide(feature.geometry)
    const diametro = diametroPorHog(n_hog)
    const canvas   = crearCanvasTorta(n_hombres, n_mujeres, diametro)

    const el = document.createElement('div')
    el.style.lineHeight = '0'
    el.title = `Hogares: ${n_hog} | Hombres: ${n_hombres} | Mujeres: ${n_mujeres}`
    el.appendChild(canvas)

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(coords)
      .addTo(mapa)

    markersRef.current.push(marker)
  }

  // Forzar que MapLibre recalcule posiciones al agregar todos los markers
  mapa.resize()
}

export function useDiagramasHogares(mapa, capasActivas, geoserverUrl) {
  const markersRef = useRef([])
  const geojsonRef = useRef(null)

  function limpiar() {
    for (const m of markersRef.current) m.remove()
    markersRef.current = []
  }

  useEffect(() => {
    const hogaresActiva = capasActivas.some(
      (c) => c.nombre_interno === 'hogares'
    )

    if (!hogaresActiva) {
      limpiar()
      return
    }

    if (!mapa) return

    let cancelado = false

    const ejecutar = () => {
      if (cancelado) return

      if (geojsonRef.current) {
        dibujarMarkers(mapa, geojsonRef.current, markersRef)
        return
      }

      fetchHogaresWFS(geoserverUrl)
        .then((geojson) => {
          if (cancelado) return
          geojsonRef.current = geojson
          dibujarMarkers(mapa, geojson, markersRef)
        })
        .catch((err) => console.error('[useDiagramasHogares] Error:', err))
    }

    // Usar 'idle' en lugar de 'load':
    // 'idle' se dispara cuando el mapa termino de renderizar por primera vez
    // y el contenedor ya tiene sus dimensiones correctas.
    // 'load' se dispara antes de que React termine de pintar el layout.
    if (mapa.loaded()) {
      // Peque_o delay para asegurar que el contenedor tiene dimensiones
      const timer = setTimeout(ejecutar, 100)
      return () => {
        cancelado = true
        clearTimeout(timer)
      }
    } else {
      mapa.once('idle', ejecutar)
      return () => {
        cancelado = true
        mapa.off('idle', ejecutar)
      }
    }
  }, [mapa, capasActivas, geoserverUrl])

  useEffect(() => () => limpiar(), [])
}
