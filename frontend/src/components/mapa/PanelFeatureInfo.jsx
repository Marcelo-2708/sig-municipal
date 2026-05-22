/**
 * Panel lateral con los atributos devueltos por WMS GetFeatureInfo.
 * Aparece al hacer click en el mapa sobre una capa externa activa.
 * Muestra cada capa con resultados como sección colapsable.
 */

import { useState } from 'react'
import Spinner from '../ui/Spinner.jsx'

// Campos internos de GIS que no aportan valor al usuario final
const CAMPOS_INTERNOS = new Set([
  'objectid', 'shape', 'shape_area', 'shape_length',
  'gid', 'fid', 'id', 'geom', 'geometry', 'the_geom',
])

/**
 * Filtra y formatea las propiedades de un feature para su presentación.
 * Omite campos nulos, vacíos e internos de GIS.
 */
function propiedadesVisibles(properties) {
  if (!properties) return []
  return Object.entries(properties).filter(([clave, valor]) => {
    if (CAMPOS_INTERNOS.has(clave.toLowerCase())) return false
    if (valor === null || valor === undefined || valor === '') return false
    return true
  })
}

/** Fila de atributo clave/valor */
function FilaAtributo({ clave, valor }) {
  const valorStr = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
  return (
    <div className="py-1.5 border-b border-gray-100 last:border-0 grid grid-cols-2 gap-2">
      <dt className="text-xs font-medium text-gray-500 truncate" title={clave}>
        {clave}
      </dt>
      <dd className="text-xs text-gray-900 break-words">{valorStr}</dd>
    </div>
  )
}

/** Tarjeta de un feature individual */
function TarjetaFeature({ feature, indice }) {
  const [expandida, setExpandida] = useState(true)
  const props = propiedadesVisibles(feature.properties)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => setExpandida((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-gray-700">
          Elemento {indice + 1}
          {feature.id ? ` — ${feature.id}` : ''}
        </span>
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform ${expandida ? '' : '-rotate-90'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expandida && (
        <div className="px-3 pb-1 pt-0.5">
          {props.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 text-center">Sin atributos disponibles</p>
          ) : (
            <dl>
              {props.map(([clave, valor]) => (
                <FilaAtributo key={clave} clave={clave} valor={valor} />
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  )
}

/** Sección de una capa con sus features */
function SeccionCapa({ capa, features }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-municipal-600 flex-shrink-0" />
        <h3 className="text-xs font-semibold text-municipal-700 uppercase tracking-wide truncate">
          {capa.nombre}
        </h3>
        <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
          {features.length} {features.length === 1 ? 'elemento' : 'elementos'}
        </span>
      </div>
      {features.map((feature, i) => (
        <TarjetaFeature key={i} feature={feature} indice={i} />
      ))}
    </div>
  )
}

/**
 * @param {object}        props
 * @param {Array|null}    props.resultados  - Array de { capa, features }
 * @param {boolean}       props.cargando
 * @param {string|null}   props.error
 * @param {Function}      props.cerrar
 */
function PanelFeatureInfo({ resultados, cargando, error, cerrar }) {
  if (!cargando && !resultados && !error) return null

  return (
    <aside
      className="
        absolute top-4 right-4 w-72
        bg-white rounded-xl shadow-xl border border-gray-200
        z-panel max-h-[calc(100vh-2rem)] flex flex-col
      "
      aria-label="Información de capas WMS"
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 bg-municipal-700 text-white rounded-t-xl flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-sm font-semibold truncate">Información de capas</h2>
        </div>
        <button
          onClick={cerrar}
          aria-label="Cerrar panel de información"
          className="p-1 rounded hover:bg-municipal-600 transition-colors flex-shrink-0 ml-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Cuerpo scrollable */}
      <div className="overflow-y-auto flex-1 px-4 py-3">
        {/* Estado de carga */}
        {cargando && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
            <Spinner tamaño="sm" />
            <span>Consultando capas…</span>
          </div>
        )}

        {/* Sin resultados / error */}
        {!cargando && error && !resultados && (
          <p className="text-xs text-gray-400 text-center py-6">{error}</p>
        )}

        {/* Resultados por capa */}
        {!cargando && resultados && resultados.map(({ capa, features }) => (
          <SeccionCapa key={capa.id} capa={capa} features={features} />
        ))}
      </div>

      {/* Pie */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 rounded-b-xl flex-shrink-0">
        <p className="text-xs text-gray-400 text-center">
          Fuente: WMS externo — datos de referencia
        </p>
      </div>
    </aside>
  )
}

export default PanelFeatureInfo
