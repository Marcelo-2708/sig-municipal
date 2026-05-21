/**
 * Panel lateral con la ficha del predio seleccionado.
 * Muestra dirección, rol SII, superficie, zona y uso de suelo.
 */

import useMapaStore from '../../store/mapaStore.js'
import useMapa from '../../hooks/useMapa.js'

// Formatea números como superficie en m²
function formatearSuperficie(m2) {
  if (m2 == null) return 'Sin datos'
  return `${Number(m2).toLocaleString('es-CL')} m²`
}

// Fila de dato en la ficha
function FilaDato({ etiqueta, valor }) {
  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{valor ?? 'Sin datos'}</dd>
    </div>
  )
}

function FichaPredio() {
  const predioResaltado = useMapaStore((s) => s.predioResaltado)
  const { limpiarResaltado } = useMapa()

  // No renderiza si no hay predio seleccionado
  if (!predioResaltado) return null

  const predio = predioResaltado

  return (
    <aside
      className="
        absolute top-4 right-4 w-72
        bg-white rounded-xl shadow-xl border border-gray-200
        z-panel max-h-[calc(100vh-2rem)] flex flex-col
      "
      aria-label="Ficha del predio seleccionado"
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 bg-municipal-700 text-white rounded-t-xl">
        <h2 className="text-sm font-semibold truncate">Ficha Predial</h2>
        <button
          onClick={limpiarResaltado}
          aria-label="Cerrar ficha predial"
          className="p-1 rounded hover:bg-municipal-600 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Contenido scrollable */}
      <div className="overflow-y-auto flex-1 px-4 py-2">
        <dl>
          <FilaDato
            etiqueta="Dirección"
            valor={predio.direccion}
          />
          <FilaDato
            etiqueta="Rol SII"
            valor={predio.rol}
          />
          <FilaDato
            etiqueta="Superficie predial"
            valor={formatearSuperficie(predio.superficie_predial ?? predio.superficie)}
          />
          <FilaDato
            etiqueta="Superficie construida"
            valor={formatearSuperficie(predio.superficie_construida)}
          />
          <FilaDato
            etiqueta="Zona"
            valor={predio.zona ?? predio.zona_uso}
          />
          <FilaDato
            etiqueta="Uso de suelo"
            valor={predio.uso_suelo ?? predio.destino}
          />
          <FilaDato
            etiqueta="Avalúo fiscal"
            valor={
              predio.avaluo_fiscal
                ? `$${Number(predio.avaluo_fiscal).toLocaleString('es-CL')}`
                : null
            }
          />
          {predio.propietario && (
            <FilaDato etiqueta="Propietario" valor={predio.propietario} />
          )}
        </dl>
      </div>

      {/* Pie con acciones */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
        <p className="text-xs text-gray-400 text-center">
          Datos según Rol SII — uso referencial
        </p>
      </div>
    </aside>
  )
}

export default FichaPredio
