/**
 * Panel flotante con datos censales de la manzana seleccionada.
 * Se posiciona cerca del punto clickeado, ajustándose si se sale por la derecha.
 * Lee estado desde mapaStore; no necesita props.
 */

import { useEffect, useRef } from 'react'
import useMapaStore from '../../store/mapaStore.js'

const PANEL_W = 300
const OFFSET_X = 15
const OFFSET_Y = 50

function fmt(val, dec = 0) {
  if (val == null || val === '') return '-'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  return dec ? n.toFixed(dec) : n.toLocaleString('es-CL')
}

// ── Gráfico de torta canvas ────────────────────────────────────────────────

function GraficoTorta({ hombres, mujeres }) {
  const canvasRef = useRef(null)
  const h     = Number(hombres) || 0
  const m     = Number(mujeres) || 0
  const total = h + m || 1

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx  = canvas.getContext('2d')
    const cx   = 60, cy = 60, r = 54
    const ini  = -Math.PI / 2
    const finH = ini + (h / total) * 2 * Math.PI

    ctx.clearRect(0, 0, 120, 120)

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, ini, finH)
    ctx.closePath()
    ctx.fillStyle = '#1565C0'
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, finH, ini + 2 * Math.PI)
    ctx.closePath()
    ctx.fillStyle = '#E91E8C'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, 2 * Math.PI)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.stroke()
  }, [h, m])

  return (
    <div className="flex flex-col items-center gap-2 py-3 border-b border-blue-100">
      <canvas ref={canvasRef} width={120} height={120} />
      <div className="flex gap-6 text-sm">
        <div className="flex items-center gap-1 font-semibold" style={{ color: '#1565C0' }}>
          <span className="text-base leading-none">♂</span>
          <span>
            {h.toLocaleString('es-CL')}
            <span className="text-xs font-normal text-gray-400 ml-1">
              ({((h / total) * 100).toFixed(0)}%)
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1 font-semibold" style={{ color: '#E91E8C' }}>
          <span className="text-base leading-none">♀</span>
          <span>
            {m.toLocaleString('es-CL')}
            <span className="text-xs font-normal text-gray-400 ml-1">
              ({((m / total) * 100).toFixed(0)}%)
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de dato individual ─────────────────────────────────────────────

function Dato({ label, value, full = false }) {
  return (
    <div className={`bg-gray-50 rounded-lg p-2.5${full ? ' col-span-2' : ''}`}>
      <div className="text-xs text-gray-400 leading-tight mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-gray-800 leading-tight">{value ?? '-'}</div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

function PanelCensalHogares() {
  const manzanaSeleccionada    = useMapaStore((s) => s.manzanaSeleccionada)
  const setManzanaSeleccionada = useMapaStore((s) => s.setManzanaSeleccionada)

  if (!manzanaSeleccionada) return null

  const p   = manzanaSeleccionada
  const num = p._num ?? '?'
  const px  = p._x  ?? 0
  const py  = p._y  ?? 0

  // Posición: aparece a la derecha del punto; si se sale de pantalla, a la izquierda
  const saleDerechaADerecha = px > window.innerWidth - (PANEL_W + OFFSET_X + 8)
  const left = saleDerechaADerecha ? px - PANEL_W - OFFSET_X : px + OFFSET_X
  const top  = Math.max(8, py - OFFSET_Y)

  return (
    <div
      role="dialog"
      aria-label="Datos censales de la manzana seleccionada"
      style={{ position: 'absolute', left, top, width: PANEL_W, zIndex: 1000 }}
      className="bg-white rounded-xl shadow-2xl border border-blue-100 overflow-hidden"
    >
      {/* Cabecera con gradiente */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)' }}
      >
        <div>
          <div className="text-xs font-medium text-blue-200 leading-tight">Manzana {num}</div>
          <div className="text-sm font-bold leading-tight">Vichuquén</div>
        </div>
        <button
          onClick={() => setManzanaSeleccionada(null)}
          aria-label="Cerrar panel censal"
          className="p-1.5 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Gráfico centrado */}
      <GraficoTorta hombres={p.n_hombres} mujeres={p.n_mujeres} />

      {/* Datos en dos columnas */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <Dato label="Total personas" value={fmt(p.n_per)} />
        <Dato label="Total hogares"  value={fmt(p.n_hog)} />
        <Dato label="Hombres"        value={fmt(p.n_hombres)} />
        <Dato label="Mujeres"        value={fmt(p.n_mujeres)} />
        <Dato label="Edad promedio"  value={fmt(p.prom_edad, 1)} />
        <Dato
          label="Escolaridad"
          value={p.prom_escol != null ? `${fmt(p.prom_escol, 1)} años` : '-'}
        />
        <Dato label="Localidad" value={p.localidad} full />
      </div>
    </div>
  )
}

export default PanelCensalHogares
