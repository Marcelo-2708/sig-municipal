/**
 * Página 404 - Ruta no encontrada.
 */

import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm">
        {/* Código de error grande */}
        <p className="text-8xl font-black text-municipal-700 mb-2">404</p>

        {/* Ícono de mapa */}
        <div className="flex justify-center mb-6">
          <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Página no encontrada</h1>
        <p className="text-gray-500 text-sm mb-8">
          La ruta que buscas no existe en este sistema.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-primario">
            Ir al mapa público
          </Link>
          <Link to="/admin" className="btn-secundario">
            Panel de administración
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFound
