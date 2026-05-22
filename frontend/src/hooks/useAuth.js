/**
 * Hook de autenticación.
 * Envuelve el authStore de Zustand y provee helpers adicionales.
 */

import useAuthStore from '../store/authStore.js'

// Jerarquía de roles: mayor índice = más privilegios
const JERARQUIA_ROLES = ['funcionario', 'editor_gis', 'admin_municipal', 'super_admin']

/**
 * @returns {{
 *   usuario: object|null,
 *   token: string|null,
 *   estaAutenticado: boolean,
 *   rol: string|null,
 *   iniciarSesion: Function,
 *   cerrarSesion: Function,
 *   tienePermiso: (rolMinimo: string) => boolean
 * }}
 */
function useAuth() {
  const usuario       = useAuthStore((s) => s.usuario)
  const token         = useAuthStore((s) => s.token)
  const iniciarSesion = useAuthStore((s) => s.iniciarSesion)
  const cerrarSesion  = useAuthStore((s) => s.cerrarSesion)

  // estaAutenticado es derivado del estado actual
  const estaAutenticado = Boolean(token && usuario)

  // Rol del usuario actual (null si no está autenticado)
  const rol = usuario?.rol ?? null

  /**
   * Verifica si el usuario tiene al menos el rol mínimo requerido.
   * @param {string} rolMinimo - Rol mínimo requerido
   * @returns {boolean}
   */
  function tienePermiso(rolMinimo) {
    if (!estaAutenticado || !rol) return false
    const nivelActual  = JERARQUIA_ROLES.indexOf(rol)
    const nivelMinimo  = JERARQUIA_ROLES.indexOf(rolMinimo)
    // Si alguno de los roles no está en la jerarquía, deniega el acceso
    if (nivelActual === -1 || nivelMinimo === -1) return false
    return nivelActual >= nivelMinimo
  }

  return {
    usuario,
    token,
    estaAutenticado,
    rol,
    iniciarSesion,
    cerrarSesion,
    tienePermiso,
  }
}

export default useAuth
