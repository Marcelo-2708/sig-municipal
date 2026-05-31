/**
 * Página pública del mapa.
 * Layout full-screen con el mapa y todos los controles superpuestos.
 * Accesible a ciudadanos sin autenticación.
 */

import { Link } from 'react-router-dom'
import MapaBase         from '../components/mapa/MapaBase.jsx'
import ControlCapas     from '../components/mapa/ControlCapas.jsx'
import BuscadorPredial  from '../components/mapa/BuscadorPredial.jsx'
import FichaPredio         from '../components/mapa/FichaPredio.jsx'
import PanelFeatureInfo    from '../components/mapa/PanelFeatureInfo.jsx'
import PanelCensalHogares from '../components/mapa/PanelCensalHogares.jsx'
import useCapas              from '../hooks/useCapas.js'
import useTenant             from '../hooks/useTenant.js'
import { useGetFeatureInfo } from '../hooks/useGetFeatureInfo.js'

function MapaPublico() {
  const { capas, capasActivas, opacidades, cargando, error, toggleCapa, setOpacidad, estaActiva } =
    useCapas()

  const { municipio, cargando: tenantCargando } = useTenant()
  const nombreMunicipio = municipio?.nombre ?? 'Municipalidad'
  const configMapa      = municipio?.config?.mapa

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
      {/* ── Mapa base — se monta sólo cuando el tenant ya respondió ────── */}
      {/* Si montara antes, configMapa sería undefined y el mapa arrancaría  */}
      {/* con el fondo por defecto ignorando la config del municipio.        */}
      {!tenantCargando && (
        <MapaBase capasActivas={capasActivas} configMapa={configMapa} />
      )}

      {/* ── Navbar superior ──────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-panel flex items-center justify-between gap-3 px-4 py-2 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
        {/* Marca */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 w-7 h-7 rounded-md bg-municipal-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-municipal-700 uppercase tracking-widest leading-none hidden sm:block">
              SIG Municipal
            </p>
            <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
              {nombreMunicipio}
            </p>
          </div>
        </div>

        {/* Acción */}
        <Link to="/login" className="btn-primario flex-shrink-0 text-xs py-1.5 px-3">
          Ingresar
        </Link>
      </header>

      {/* ── Buscador predial (centrado arriba) ──────────────────────────── */}
      <BuscadorPredial />

      {/* ── Panel de capas (esquina superior izquierda, se posiciona solo) ── */}
      <ControlCapas
        capas={capas}
        cargando={cargando}
        error={error}
        toggleCapa={toggleCapa}
        setOpacidad={setOpacidad}
        estaActiva={estaActiva}
        opacidades={opacidades}
      />

      {/* ── Panel GetFeatureInfo (esquina superior derecha) ─────────────── */}
      <PanelFeatureInfo
        resultados={featureResultados}
        cargando={featureCargando}
        error={featureError}
        cerrar={cerrarFeatureInfo}
      />

      {/* ── Ficha predial — se oculta cuando hay resultados de GFI ─────── */}
      {mostrarFichaPredio && <FichaPredio />}

      {/* ── Panel censal de manzana hogares (Vichuquén) ─────────────────── */}
      <PanelCensalHogares />
    </div>
  )
}

export default MapaPublico
