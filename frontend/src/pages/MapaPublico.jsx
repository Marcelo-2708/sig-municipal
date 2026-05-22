/**
 * Página pública del mapa.
 * Layout full-screen con el mapa y todos los controles superpuestos.
 * Accesible a ciudadanos sin autenticación.
 */

import { Link } from 'react-router-dom'
import MapaBase         from '../components/mapa/MapaBase.jsx'
import ControlCapas     from '../components/mapa/ControlCapas.jsx'
import BuscadorPredial  from '../components/mapa/BuscadorPredial.jsx'
import FichaPredio      from '../components/mapa/FichaPredio.jsx'
import PanelFeatureInfo from '../components/mapa/PanelFeatureInfo.jsx'
import useCapas              from '../hooks/useCapas.js'
import useTenant             from '../hooks/useTenant.js'
import { useGetFeatureInfo } from '../hooks/useGetFeatureInfo.js'

function MapaPublico() {
  const { capas, capasActivas, opacidades, cargando, error, toggleCapa, setOpacidad, estaActiva } =
    useCapas()

  const { municipio } = useTenant()
  const nombreMunicipio = municipio?.nombre ?? 'Municipalidad'

  // GetFeatureInfo: se activa con cada click sobre el mapa
  const {
    resultados: featureResultados,
    cargando:   featureCargando,
    error:      featureError,
    cerrar:     cerrarFeatureInfo,
  } = useGetFeatureInfo(capasActivas)

  // Si hay resultados de GFI, el panel de FichaPredio se oculta para no solaparse
  const mostrarFichaPredio = !featureCargando && !featureResultados && !featureError

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* ── Mapa base (capa inferior) ────────────────────────────────────── */}
      <MapaBase capasActivas={capasActivas} />

      {/* ── Header mínimo ────────────────────────────────────────────────── */}
      <header
        className="
          absolute top-0 left-0 right-0 z-panel
          flex items-center justify-between
          px-4 py-2 bg-white/80 backdrop-blur-sm border-b border-gray-200
          md:left-72
        "
      >
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-municipal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h1 className="text-sm font-semibold text-gray-800 hidden sm:block">
            SIG — {nombreMunicipio}
          </h1>
        </div>

        <Link to="/login" className="btn-primario text-xs py-1.5 px-3">
          Ingresar
        </Link>
      </header>

      {/* ── Buscador predial (centrado arriba) ──────────────────────────── */}
      <BuscadorPredial />

      {/* ── Panel de capas (esquina superior izquierda) ──────────────────── */}
      <div className="absolute top-16 left-4 z-controles">
        <ControlCapas
          capas={capas}
          cargando={cargando}
          error={error}
          toggleCapa={toggleCapa}
          setOpacidad={setOpacidad}
          estaActiva={estaActiva}
          opacidades={opacidades}
        />
      </div>

      {/* ── Panel GetFeatureInfo (esquina superior derecha) ─────────────── */}
      <PanelFeatureInfo
        resultados={featureResultados}
        cargando={featureCargando}
        error={featureError}
        cerrar={cerrarFeatureInfo}
      />

      {/* ── Ficha predial — se oculta cuando hay resultados de GFI ─────── */}
      {mostrarFichaPredio && <FichaPredio />}
    </div>
  )
}

export default MapaPublico
