/**
 * Página de inicio del panel de administración.
 * Muestra un resumen del sistema y accesos rápidos.
 */

import { Link } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import useTenant from '../hooks/useTenant.js'

// Tarjeta de acceso rápido
function TarjetaAcceso({ titulo, descripcion, ruta, icono }) {
  return (
    <Link
      to={ruta}
      className="
        block p-5 bg-white rounded-xl border border-gray-200 shadow-sm
        hover:shadow-md hover:border-municipal-300 transition-all
        group
      "
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-municipal-100 rounded-lg flex items-center justify-center
                        group-hover:bg-municipal-200 transition-colors flex-shrink-0">
          {icono}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-municipal-700 transition-colors">
            {titulo}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{descripcion}</p>
        </div>
      </div>
    </Link>
  )
}

function Dashboard() {
  const { usuario } = useAuth()
  const { municipio } = useTenant()

  const nombreMunicipio = municipio?.nombre ?? 'Municipalidad'
  const ahora = new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="max-w-4xl space-y-6">
      {/* Encabezado de bienvenida */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {usuario?.nombre ?? 'Usuario'}
        </h1>
        <p className="text-gray-500 mt-1">
          {nombreMunicipio} · {ahora}
        </p>
      </div>

      {/* Tarjetas de acceso rápido */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TarjetaAcceso
            ruta="/admin/capas"
            titulo="Gestión de Capas"
            descripcion="Administra las capas WMS del municipio"
            icono={
              <svg className="w-5 h-5 text-municipal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            }
          />
          <TarjetaAcceso
            ruta="/"
            titulo="Ver Mapa Público"
            descripcion="Visualiza el mapa como lo ven los ciudadanos"
            icono={
              <svg className="w-5 h-5 text-municipal-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Información del tenant */}
      {municipio && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Información del municipio
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {municipio.nombre && (
              <>
                <dt className="text-gray-500">Nombre</dt>
                <dd className="text-gray-900 font-medium">{municipio.nombre}</dd>
              </>
            )}
            {municipio.region && (
              <>
                <dt className="text-gray-500">Región</dt>
                <dd className="text-gray-900">{municipio.region}</dd>
              </>
            )}
            {municipio.slug && (
              <>
                <dt className="text-gray-500">Subdominio</dt>
                <dd className="text-gray-900 font-mono text-xs">{municipio.slug}.sig.cl</dd>
              </>
            )}
          </dl>
        </section>
      )}
    </div>
  )
}

export default Dashboard
