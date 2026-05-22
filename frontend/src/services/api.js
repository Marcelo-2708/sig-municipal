/**
 * Cliente HTTP base para la API del backend.
 *
 * Características:
 * - Adjunta automáticamente el header Authorization: Bearer <token>
 * - Maneja el refresco automático del token cuando recibe 401
 * - Evita múltiples llamadas simultáneas al endpoint de refresh (cola única)
 * - Lanza errores con mensajes legibles para mostrar en la UI
 */

import { BASE_URL, CABECERAS_JSON, TIMEOUT_MS } from '../config/api.js'
import useAuthStore from '../store/authStore.js'

// Promesa de refresco compartida: evita múltiples refresh simultáneos
let promesaRefrescando = null

/**
 * Intenta refrescar el token de acceso usando el token de refresco.
 * Si falla, cierra la sesión y redirige al login.
 * @returns {Promise<string>} Nuevo token de acceso
 */
async function refrescarToken() {
  const { tokenRefresco, actualizarToken, cerrarSesion } = useAuthStore.getState()

  if (!tokenRefresco) {
    cerrarSesion()
    window.location.href = '/login'
    throw new Error('Sin token de refresco. Por favor ingresa nuevamente.')
  }

  const respuesta = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: CABECERAS_JSON,
    body: JSON.stringify({ refreshToken: tokenRefresco }),
  })

  if (!respuesta.ok) {
    cerrarSesion()
    window.location.href = '/login'
    throw new Error('Sesión expirada. Por favor ingresa nuevamente.')
  }

  const datos = await respuesta.json()
  actualizarToken(datos.accessToken)
  return datos.accessToken
}

/**
 * Función principal de petición HTTP.
 *
 * @param {string} metodo  - Método HTTP ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')
 * @param {string} ruta    - Ruta relativa, ej: '/api/capas/publicas'
 * @param {object} [datos] - Cuerpo de la petición (solo para POST/PUT/PATCH)
 * @param {object} [opciones] - Opciones adicionales de fetch
 * @returns {Promise<any>} Datos de la respuesta parseados como JSON
 */
export async function peticion(metodo, ruta, datos = null, opciones = {}) {
  const { token } = useAuthStore.getState()

  // Construye las cabeceras de la petición
  const cabeceras = { ...CABECERAS_JSON }
  if (token) {
    cabeceras['Authorization'] = `Bearer ${token}`
  }

  const metodoNormalizado = metodo.toUpperCase()

  // Opciones base de fetch
  const opcionesFetch = {
    method: metodoNormalizado,
    headers: cabeceras,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...opciones,
  }

  // Adjunta cuerpo JSON si corresponde
  if (datos !== null && ['POST', 'PUT', 'PATCH'].includes(metodoNormalizado)) {
    opcionesFetch.body = JSON.stringify(datos)
  }

  const url = `${BASE_URL}${ruta}`
  let respuesta = await fetch(url, opcionesFetch)

  // ── Manejo de 401: intenta refrescar el token una sola vez ──────────────
  if (respuesta.status === 401) {
    // Reutiliza la promesa en curso si ya hay un refresh activo
    if (!promesaRefrescando) {
      promesaRefrescando = refrescarToken().finally(() => {
        promesaRefrescando = null
      })
    }

    let nuevoToken
    try {
      nuevoToken = await promesaRefrescando
    } catch (errorRefresh) {
      // El refresh falló; el cerrarSesion ya fue llamado dentro de refrescarToken
      throw errorRefresh
    }

    // Reintenta la petición original con el nuevo token
    opcionesFetch.headers = {
      ...cabeceras,
      Authorization: `Bearer ${nuevoToken}`,
    }
    respuesta = await fetch(url, opcionesFetch)
  }

  // ── Manejo de errores HTTP 4xx / 5xx ────────────────────────────────────
  if (!respuesta.ok) {
    let mensajeError = `Error ${respuesta.status}: ${respuesta.statusText}`
    try {
      const cuerpoError = await respuesta.json()
      const msg = cuerpoError.mensaje ?? cuerpoError.message ?? cuerpoError.error
      if (msg) mensajeError = msg
    } catch {
      // El cuerpo no es JSON válido; usa el mensaje HTTP genérico
    }
    const error = new Error(mensajeError)
    error.estado = respuesta.status
    throw error
  }

  // Respuestas sin cuerpo (204 No Content)
  if (respuesta.status === 204) {
    return null
  }

  return respuesta.json()
}

// Atajos para los métodos HTTP más comunes
const api = {
  get: (ruta, { params, ...resto } = {}) => {
    const qs = params
      ? '?' + new URLSearchParams(
          Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
        ).toString()
      : ''
    return peticion('GET', ruta + qs, null, resto)
  },
  post:   (ruta, datos) => peticion('POST',   ruta, datos),
  put:    (ruta, datos) => peticion('PUT',    ruta, datos),
  patch:  (ruta, datos) => peticion('PATCH',  ruta, datos),
  delete: (ruta)        => peticion('DELETE', ruta),
}

export default api
