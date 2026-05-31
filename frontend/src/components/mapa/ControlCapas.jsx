/**
 * Panel de control de capas WMS.
 * Flotante en la esquina superior izquierda del mapa.
 * Colapsable, con toggle switch moderno e íconos de geometría por capa.
 */

import { useState, useMemo } from 'react'
import Spinner from '../ui/Spinner.jsx'

// ── Íconos de tipo de geometría ───────────────────────────────────────────

function IconoPoligono() {
  return (
    <svg viewBox="0 0 16 16" className="w-full h-full" fill="currentColor">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" fillOpacity=".25" />
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function IconoLinea() {
  return (
    <svg viewBox="0 0 16 16" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 13L6 8l3 3 5-8" />
    </svg>
  )
}

function IconoPunto() {
  return (
    <svg viewBox="0 0 16 16" className="w-full h-full">
      <circle cx="8" cy="8" r="4.5" fill="currentColor" fillOpacity=".3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  )
}

function IconoCapas() {
  return (
    <svg viewBox="0 0 16 16" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M8 1.5L14 5 8 8.5 2 5 8 1.5z" />
      <path d="M2 8l6 3.5L14 8" />
      <path d="M2 11l6 3.5 6-3.5" />
    </svg>
  )
}

// Detecta el tipo de ícono por nombre_interno o tipo_geometria
function resolverIcono(capa) {
  const tipo   = (capa.tipo_geometria ?? '').toLowerCase()
  const nombre = (capa.nombre_interno ?? '').toLowerCase()

  const esPoligono =
    tipo.includes('polygon') ||
    ['censo', 'manzana', 'amenaza', 'zona', 'predio', 'parcela'].some((k) => nombre.includes(k))
  const esLinea =
    tipo.includes('line') ||
    ['vial', 'via', 'calle', 'red', 'canal', 'rio'].some((k) => nombre.includes(k))
  const esPunto =
    tipo.includes('point') ||
    ['hogar', 'punto', 'poste', 'equip', 'local'].some((k) => nombre.includes(k))

  if (esPoligono) return { Icono: IconoPoligono, color: 'text-blue-500' }
  if (esLinea)    return { Icono: IconoLinea,    color: 'text-amber-500' }
  if (esPunto)    return { Icono: IconoPunto,    color: 'text-emerald-500' }
  return { Icono: IconoCapas, color: 'text-gray-400' }
}

// ── Toggle switch ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`
        relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors duration-200 focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-municipal-500 focus-visible:ring-offset-1
        ${checked ? 'bg-municipal-600' : 'bg-gray-200'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm
          transform transition-transform duration-200
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  )
}

// ── Fila de capa individual ───────────────────────────────────────────────

function FilaCapa({ capa, activa, opacidad, onToggle, onOpacidad }) {
  const { Icono, color } = resolverIcono(capa)

  return (
    <li className="px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-2.5">
        {/* Ícono de geometría */}
        <span className={`w-5 h-5 flex-shrink-0 ${color}`}>
          <Icono />
        </span>

        {/* Nombre — ocupa el espacio disponible */}
        <span className="flex-1 min-w-0 text-xs font-medium text-gray-700 leading-tight truncate">
          {capa.nombre}
        </span>

        {/* Toggle */}
        <Toggle
          checked={activa}
          onChange={() => onToggle(capa.id)}
          label={`${activa ? 'Ocultar' : 'Mostrar'} capa ${capa.nombre}`}
        />
      </div>

      {/* Slider de opacidad — solo cuando la capa está activa */}
      {activa && (
        <div className="flex items-center gap-2 pl-7">
          <input
            type="range"
            min="0" max="1" step="0.05"
            value={opacidad}
            onChange={(e) => onOpacidad(capa.id, parseFloat(e.target.value))}
            className="flex-1 h-1.5 rounded-full accent-municipal-600 cursor-pointer"
            aria-label={`Opacidad de ${capa.nombre}`}
          />
          <span className="text-xs text-gray-400 tabular-nums w-7 text-right">
            {Math.round(opacidad * 100)}%
          </span>
        </div>
      )}
    </li>
  )
}

// ── Componente principal ──────────────────────────────────────────────────

function ControlCapas({
  capas = [],
  cargando = false,
  error = null,
  toggleCapa,
  setOpacidad,
  estaActiva,
  opacidades = {},
}) {
  const [expandido,            setExpandido]            = useState(true)
  const [categoriasExpandidas, setCategoriasExpandidas] = useState({})

  const categorias = useMemo(() => {
    const mapa = {}
    for (const capa of capas) {
      const cat = capa.categoria ?? 'Otras'
      if (!mapa[cat]) mapa[cat] = []
      mapa[cat].push(capa)
    }
    return mapa
  }, [capas])

  function toggleCategoria(nombre) {
    setCategoriasExpandidas((prev) => ({ ...prev, [nombre]: !prev[nombre] }))
  }

  return (
    <div
      className={`
        absolute top-16 left-4 z-controles
        w-[260px] bg-white/95 backdrop-blur-sm
        rounded-xl shadow-2xl border border-gray-100
        flex flex-col max-h-[calc(100vh-5rem)]
        transition-all duration-200
      `}
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 text-municipal-600">
            <IconoCapas />
          </div>
          <span className="text-sm font-semibold text-gray-800">Capas</span>
          {!cargando && capas.length > 0 && (
            <span className="text-xs text-gray-400">
              ({capas.filter((c) => estaActiva(c.id)).length}/{capas.length})
            </span>
          )}
        </div>
        <button
          onClick={() => setExpandido((v) => !v)}
          aria-label={expandido ? 'Colapsar panel de capas' : 'Expandir panel de capas'}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${expandido ? '' : 'rotate-180'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Contenido colapsable */}
      {expandido && (
        <div className="overflow-y-auto flex-1">
          {/* Cargando */}
          {cargando && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
              <Spinner tamaño="sm" />
              <span>Cargando capas…</span>
            </div>
          )}

          {/* Error */}
          {error && !cargando && (
            <div className="mx-3 my-3 px-3 py-2 rounded-lg bg-red-50 text-xs text-red-600 border border-red-100">
              No se pudieron cargar las capas.
            </div>
          )}

          {/* Sin capas */}
          {!cargando && !error && capas.length === 0 && (
            <p className="py-6 text-xs text-gray-400 text-center">
              No hay capas disponibles.
            </p>
          )}

          {/* Grupos por categoría */}
          {Object.entries(categorias).map(([nombreCat, capasGrupo], idxCat) => (
            <div key={nombreCat}>
              {/* Separador entre categorías (excepto la primera) */}
              {idxCat > 0 && <div className="mx-3 border-t border-gray-100" />}

              {/* Encabezado de categoría */}
              <button
                onClick={() => toggleCategoria(nombreCat)}
                className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {nombreCat}
                  <span className="ml-1.5 font-normal normal-case text-gray-400">
                    ({capasGrupo.length})
                  </span>
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-gray-300 transition-transform duration-150 ${
                    categoriasExpandidas[nombreCat] === false ? '-rotate-90' : ''
                  }`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Capas de la categoría */}
              {categoriasExpandidas[nombreCat] !== false && (
                <ul className="divide-y divide-gray-50">
                  {capasGrupo.map((capa) => (
                    <FilaCapa
                      key={capa.id}
                      capa={capa}
                      activa={estaActiva(capa.id)}
                      opacidad={opacidades[capa.id] ?? 1}
                      onToggle={toggleCapa}
                      onOpacidad={setOpacidad}
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ControlCapas
