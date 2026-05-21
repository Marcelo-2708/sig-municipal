/**
 * Panel de control de capas WMS.
 * Flotante en la esquina superior izquierda del mapa.
 * Agrupa las capas por categoría y permite toggle + ajuste de opacidad.
 * Colapsable en dispositivos móviles.
 */

import { useState, useMemo } from 'react'
import Badge from '../ui/Badge.jsx'
import Spinner from '../ui/Spinner.jsx'

/**
 * @param {object}   props
 * @param {Array}    props.capas       - Lista completa de capas disponibles
 * @param {boolean}  props.cargando    - Estado de carga
 * @param {object|null} props.error    - Error de carga
 * @param {Function} props.toggleCapa  - Activa/desactiva una capa
 * @param {Function} props.setOpacidad - Cambia la opacidad de una capa
 * @param {Function} props.estaActiva  - Indica si una capa está activa
 * @param {object}   props.opacidades  - Mapa id → opacidad actual
 */
function ControlCapas({
  capas = [],
  cargando = false,
  error = null,
  toggleCapa,
  setOpacidad,
  estaActiva,
  opacidades = {},
}) {
  const [expandido, setExpandido] = useState(true)
  const [categoriasExpandidas, setCategoriasExpandidas] = useState({})

  // Agrupa las capas por categoría
  const categorias = useMemo(() => {
    const mapa = {}
    for (const capa of capas) {
      const cat = capa.categoria ?? 'Sin categoría'
      if (!mapa[cat]) mapa[cat] = []
      mapa[cat].push(capa)
    }
    return mapa
  }, [capas])

  function toggleCategoria(nombre) {
    setCategoriasExpandidas((prev) => ({
      ...prev,
      [nombre]: !prev[nombre],
    }))
  }

  return (
    <div className="panel-flotante top-4 left-4 w-64 max-h-[calc(100vh-2rem)] flex flex-col z-controles">
      {/* Cabecera del panel */}
      <div className="flex items-center justify-between px-3 py-2 bg-municipal-700 text-white rounded-t-lg">
        <span className="text-sm font-semibold">Capas</span>
        <button
          onClick={() => setExpandido((v) => !v)}
          aria-label={expandido ? 'Colapsar panel de capas' : 'Expandir panel de capas'}
          className="p-1 rounded hover:bg-municipal-600 transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${expandido ? '' : 'rotate-180'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Contenido colapsable */}
      {expandido && (
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {/* Estado de carga */}
          {cargando && (
            <div className="flex items-center justify-center p-4 gap-2 text-sm text-gray-500">
              <Spinner tamaño="sm" />
              <span>Cargando capas…</span>
            </div>
          )}

          {/* Error de carga */}
          {error && !cargando && (
            <div className="p-3 text-xs text-red-600 bg-red-50">
              No se pudieron cargar las capas.
            </div>
          )}

          {/* Lista vacía */}
          {!cargando && !error && capas.length === 0 && (
            <p className="p-3 text-xs text-gray-500 text-center">
              No hay capas disponibles.
            </p>
          )}

          {/* Capas agrupadas por categoría */}
          {Object.entries(categorias).map(([nombreCat, capasGrupo]) => (
            <div key={nombreCat}>
              {/* Encabezado de categoría */}
              <button
                onClick={() => toggleCategoria(nombreCat)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Badge categoria={nombreCat.toLowerCase()} texto={nombreCat} />
                  <span className="text-xs text-gray-500">({capasGrupo.length})</span>
                </div>
                <svg
                  className={`w-3 h-3 text-gray-400 transition-transform ${
                    categoriasExpandidas[nombreCat] === false ? '-rotate-90' : ''
                  }`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Capas de la categoría */}
              {categoriasExpandidas[nombreCat] !== false && (
                <ul className="px-3 pb-2 space-y-2">
                  {capasGrupo.map((capa) => (
                    <li key={capa.id} className="space-y-1">
                      {/* Toggle de visibilidad */}
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={estaActiva(capa.id)}
                          onChange={() => toggleCapa(capa.id)}
                          className="rounded border-gray-300 text-municipal-600 focus:ring-municipal-500"
                          aria-label={`Mostrar capa ${capa.nombre}`}
                        />
                        <span className="text-xs text-gray-700 group-hover:text-gray-900 leading-tight">
                          {capa.nombre}
                        </span>
                      </label>

                      {/* Slider de opacidad (solo si la capa está activa) */}
                      {estaActiva(capa.id) && (
                        <div className="flex items-center gap-2 pl-5">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={opacidades[capa.id] ?? 1}
                            onChange={(e) => setOpacidad(capa.id, parseFloat(e.target.value))}
                            className="flex-1 h-1 accent-municipal-600"
                            aria-label={`Opacidad de capa ${capa.nombre}`}
                          />
                          <span className="text-xs text-gray-400 w-8 text-right">
                            {Math.round((opacidades[capa.id] ?? 1) * 100)}%
                          </span>
                        </div>
                      )}
                    </li>
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
