/**
 * Configuración central de la API.
 * La URL base se toma de la variable de entorno VITE_API_URL;
 * en desarrollo el proxy de Vite redirige /api al backend.
 */

// En producción usa la URL completa; en desarrollo usa el proxy de Vite
export const BASE_URL = import.meta.env.VITE_API_URL ?? ''

// URL del servidor GeoServer para WMS/WFS
export const GEOSERVER_URL =
  import.meta.env.VITE_GEOSERVER_URL ?? '/geoserver'

// Tiempo máximo de espera para peticiones (milisegundos)
export const TIMEOUT_MS = 15_000

// Cabeceras comunes para todas las peticiones JSON
export const CABECERAS_JSON = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
}
