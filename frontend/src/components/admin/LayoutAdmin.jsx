/**
 * Layout del panel de administración.
 * Protege las rutas hijas: redirige a /login si el usuario no está autenticado.
 * Renderiza el sidebar de navegación y el área de contenido principal.
 */

import { Navigate, Outlet, NavLink, useNavigate } from 'react-router-dom'
import useAuth from '../../hooks/useAuth.js'

// Ítems del menú lateral de administración
const MENU_ADMIN = [
  {
    ruta: '/admin',
    etiqueta: 'Inicio',
    icono: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    exacto: true,
  },
  {
    ruta: '/admin/capas',
    etiqueta: 'Capas',
    icono: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
    exacto: false,
  },
]

function LayoutAdmin() {
  const { estaAutenticado, usuario, cerrarSesion } = useAuth()
  const navegar = useNavigate()

  // Protección de ruta: redirige a login si no está autenticado
  if (!estaAutenticado) {
    return <Navigate to="/login" replace />
  }

  function manejarCerrarSesion() {
    cerrarSesion()
    navegar('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-64 bg-municipal-900 text-white flex flex-col flex-shrink-0">
        {/* Logo / nombre del sistema */}
        <div className="px-6 py-5 border-b border-municipal-800">
          <h1 className="text-lg font-bold tracking-tight">SIG Municipal</h1>
          <p className="text-xs text-municipal-300 mt-0.5">Panel de Administración</p>
        </div>

        {/* Navegación principal */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Navegación del panel admin">
          {MENU_ADMIN.map((item) => (
            <NavLink
              key={item.ruta}
              to={item.ruta}
              end={item.exacto}
              aria-label={`Ir a ${item.etiqueta}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-municipal-700 text-white'
                    : 'text-municipal-200 hover:bg-municipal-800 hover:text-white'
                }`
              }
            >
              {item.icono}
              {item.etiqueta}
            </NavLink>
          ))}
        </nav>

        {/* Info del usuario + botón de cierre de sesión */}
        <div className="px-4 py-4 border-t border-municipal-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-municipal-600 flex items-center justify-center text-sm font-bold">
              {usuario?.nombre?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{usuario?.nombre ?? 'Usuario'}</p>
              <p className="text-xs text-municipal-300 truncate capitalize">{usuario?.rol ?? ''}</p>
            </div>
          </div>
          <button
            onClick={manejarCerrarSesion}
            aria-label="Cerrar sesión"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-municipal-200
                       hover:bg-municipal-800 hover:text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Área principal ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Outlet renderiza la página activa */}
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default LayoutAdmin
