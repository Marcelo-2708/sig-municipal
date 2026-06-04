/**
 * Panel flotante especializado para la capa "amenaza".
 * Muestra el nivel de amenaza (gridcode) con badge de color y demás campos filtrados.
 * Se posiciona cerca del punto clickeado, ajustándose si se sale por la derecha.
 */

const PANEL_W  = 300
const OFFSET_X = 15
const OFFSET_Y = 50

// Campos técnicos que no se muestran al usuario
const CAMPOS_FILTRAR = new Set(['ogc_fid', 'qc_id', 'id', 'objectid', 'gridcode'])

function esCampoFiltrado(clave) {
  const c = clave.toLowerCase()
  return CAMPOS_FILTRAR.has(c) || c.startsWith('shape_')
}

// Descripción del nivel de amenaza según gridcode
const NIVEL = {
  1: { label: 'Baja',  clases: 'bg-green-100 text-green-700 border border-green-200'  },
  2: { label: 'Media', clases: 'bg-orange-100 text-orange-700 border border-orange-200' },
  3: { label: 'Alta',  clases: 'bg-red-100 text-red-700 border border-red-200'        },
}

function BadgeAmenaza({ gridcode }) {
  const n    = Number(gridcode)
  const info = NIVEL[n] ?? { label: `Código ${n || '?'}`, clases: 'bg-gray-100 text-gray-600 border border-gray-200' }

  return (
    <div className="flex flex-col items-center gap-2 py-4 border-b border-blue-100">
      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
        {/* ícono advertencia */}
        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-1.5">Nivel de amenaza</p>
        <span className={`inline-block px-4 py-1 rounded-full text-sm font-bold ${info.clases}`}>
          {info.label}
        </span>
      </div>
    </div>
  )
}

function FilaExtra({ label, valor }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <div className="text-xs text-gray-400 leading-tight mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-gray-800 leading-tight">{String(valor)}</div>
    </div>
  )
}

/**
 * @param {object}        props
 * @param {object}        props.resultado   - { capa, features } de la capa amenaza
 * @param {{ x, y }}      props.clickPos    - Posición del click en píxeles del mapa
 * @param {Function}      props.cerrar
 */
function PanelAmenaza({ resultado, clickPos, cerrar }) {
  if (!resultado || !clickPos) return null

  const feature    = resultado.features[0]
  const properties = feature?.properties ?? {}
  const gridcode   = properties.gridcode ?? properties.GRIDCODE

  // Campos extra: todo lo que no es gridcode ni campo interno
  const extras = Object.entries(properties).filter(([k, v]) => {
    if (esCampoFiltrado(k)) return false
    if (v === null || v === undefined || v === '') return false
    return true
  })

  // Posición: a la derecha del click; si se sale, a la izquierda
  const px = clickPos.x
  const py = clickPos.y
  const saleADerecha = px > window.innerWidth - (PANEL_W + OFFSET_X + 8)
  const left = saleADerecha ? px - PANEL_W - OFFSET_X : px + OFFSET_X
  const top  = Math.max(8, py - OFFSET_Y)

  return (
    <div
      role="dialog"
      aria-label="Información de zona de amenaza"
      style={{ position: 'absolute', left, top, width: PANEL_W, zIndex: 1000 }}
      className="bg-white rounded-xl shadow-2xl border border-blue-100 overflow-hidden"
    >
      {/* Cabecera con gradiente */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)' }}
      >
        <div>
          <div className="text-xs font-medium text-blue-200 leading-tight">Vichuquén</div>
          <div className="text-sm font-bold leading-tight">Zona de Amenaza</div>
        </div>
        <button
          onClick={cerrar}
          aria-label="Cerrar panel de amenaza"
          className="p-1.5 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Badge de nivel */}
      <BadgeAmenaza gridcode={gridcode} />

      {/* Campos extra (si los hay) */}
      {extras.length > 0 && (
        <div className="grid grid-cols-2 gap-2 p-3">
          {extras.map(([k, v]) => (
            <FilaExtra key={k} label={k} valor={v} />
          ))}
        </div>
      )}
    </div>
  )
}

export default PanelAmenaza
