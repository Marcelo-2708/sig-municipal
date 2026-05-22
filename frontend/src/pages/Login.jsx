/**
 * Página de inicio de sesión.
 * Redirige a /admin si el usuario es funcionario o admin,
 * o a / si es ciudadano.
 */

import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import api from '../services/api.js'
import Spinner from '../components/ui/Spinner.jsx'

function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [cargando, setCargando] = useState(false)

  const { iniciarSesion, estaAutenticado } = useAuth()
  const navegar = useNavigate()

  // Si ya está autenticado, redirige directamente
  if (estaAutenticado) {
    return <Navigate to="/admin" replace />
  }

  async function manejarEnvio(e) {
    e.preventDefault()
    setError(null)
    setCargando(true)

    try {
      const respuesta = await api.post('/api/auth/login', { email, password })
      const { accessToken, refreshToken, usuario } = respuesta

      iniciarSesion(usuario, accessToken, refreshToken)

      // Redirige según el rol del usuario
      const rolUsuario = usuario?.rol ?? ''
      if (['super_admin', 'admin_municipal', 'editor_gis', 'funcionario'].includes(rolUsuario)) {
        navegar('/admin', { replace: true })
      } else {
        navegar('/', { replace: true })
      }
    } catch (err) {
      setError(err.message ?? 'Error al iniciar sesión. Verifica tus credenciales.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Cabecera */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-municipal-700 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SIG Municipal</h1>
          <p className="text-sm text-gray-500 mt-1">Acceso para funcionarios municipales</p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={manejarEnvio}
          noValidate
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4"
        >
          {/* Mensaje de error */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
            >
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Campo email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="funcionario@municipio.cl"
              className="campo-texto"
              disabled={cargando}
            />
          </div>

          {/* Campo contraseña */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="campo-texto"
              disabled={cargando}
            />
          </div>

          {/* Botón de ingreso */}
          <button
            type="submit"
            disabled={cargando || !email || !password}
            className="btn-primario w-full mt-2"
          >
            {cargando ? (
              <>
                <Spinner tamaño="sm" className="mr-2" />
                Verificando…
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        {/* Volver al mapa público */}
        <p className="text-center text-sm text-gray-500 mt-4">
          <Link to="/" className="text-municipal-700 hover:underline">
            ← Volver al mapa público
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Login
