/**
 * Selector de mapa base.
 * Muestra botones para cambiar entre Calles, Satélite y Oscuro.
 */

import useMapaStore from '../../store/mapaStore.js'
import { MAPAS_BASE } from '../../config/mapas.js'

function SelectorMapaBase() {
  const mapaBaseActivo = useMapaStore((s) => s.mapaBaseActivo)
  const setMapaBase    = useMapaStore((s) => s.setMapaBase)

  return (
    <div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-controles"
      role="group"
      aria-label="Selector de mapa base"
    >
      <div className="flex items-center bg-white rounded-full shadow-lg border border-gray-200 p-1 gap-1">
        {Object.values(MAPAS_BASE).map((mapa) => (
          <button
            key={mapa.id}
            onClick={() => setMapaBase(mapa.id)}
            aria-label={`Cambiar a mapa base ${mapa.nombre}`}
            aria-pressed={mapaBaseActivo === mapa.id}
            title={mapa.descripcion}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              transition-all duration-150
              ${
                mapaBaseActivo === mapa.id
                  ? 'bg-municipal-700 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            <span role="img" aria-hidden="true">{mapa.icono}</span>
            <span>{mapa.nombre}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default SelectorMapaBase
