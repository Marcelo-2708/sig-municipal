/**
 * Hook para detectar el tenant (municipio) activo.
 *
 * Estrategia de resolución:
 * 1. Extrae el primer segmento del subdominio de window.location.hostname
 *    Ej: "sig.concepcion.cl" → "concepcion"
 * 2. Si estamos en localhost o 127.0.0.1, usa VITE_TENANT_DEV
 * 3. Consulta GET /api/tenant/info para obtener datos del municipio
 */

import { useQuery } from '@tanstack/react-query'
import api from '../services/api.js'

// Dominios que indican entorno de desarrollo
const DOMINIOS_DEV = ['localhost', '127.0.0.1', '0.0.0.0']

/**
 * Detecta el slug del tenant desde el subdominio o la variable de entorno.
 * @returns {string} Slug del tenant (ej: "concepcion", "demo")
 */
export function detectarTenant() {
  const hostname = window.location.hostname

  // En desarrollo, usa la variable de entorno
  if (DOMINIOS_DEV.includes(hostname)) {
    return import.meta.env.VITE_TENANT_DEV ?? 'demo'
  }

  // En producción, extrae el subdominio (primer segmento)
  // Ej: "sig.concepcion.cl" → ["sig", "concepcion", "cl"] → "sig"
  // Si el patrón es "concepcion.sig.cl" → "concepcion"
  const partes = hostname.split('.')
  if (partes.length >= 3) {
    return partes[0]
  }

  // Fallback al tenant de desarrollo
  return import.meta.env.VITE_TENANT_DEV ?? 'demo'
}

/**
 * Hook que retorna información del municipio activo.
 *
 * @returns {{
 *   tenant: string,
 *   municipio: object|null,
 *   cargando: boolean,
 *   error: Error|null
 * }}
 */
function useTenant() {
  const tenant = detectarTenant()

  const {
    data: municipio,
    isLoading: cargando,
    error,
  } = useQuery({
    queryKey: ['tenant-info', tenant],
    queryFn: () => api.get('/api/tenant/info'),
    // Los datos del municipio no cambian durante la sesión
    staleTime: Infinity,
    // No reintenta si falla (el tenant puede no existir)
    retry: false,
    // Permite fallos silenciosos para no bloquear la app
    throwOnError: false,
  })

  return {
    tenant,
    municipio: municipio ?? null,
    cargando,
    error,
  }
}

export default useTenant
