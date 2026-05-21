/**
 * Hook para gestionar las capas WMS del municipio.
 * Combina TanStack Query (para el fetch) con estado local (para activaciones
 * y opacidades que no necesitan persistencia en servidor).
 */

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api.js'

/**
 * @returns {{
 *   capas: Array,
 *   capasActivas: Array,
 *   opacidades: Record<string, number>,
 *   cargando: boolean,
 *   error: Error|null,
 *   toggleCapa: (id: string) => void,
 *   setOpacidad: (id: string, valor: number) => void,
 *   estaActiva: (id: string) => boolean,
 * }}
 */
function useCapas() {
  // IDs de las capas actualmente visibles en el mapa
  const [idsActivos, setIdsActivos] = useState(new Set())

  // Opacidades individuales por ID de capa (valor entre 0 y 1)
  const [opacidades, setOpacidadesMap] = useState({})

  // Carga las capas públicas del tenant desde el backend
  const {
    data: capas = [],
    isLoading: cargando,
    error,
  } = useQuery({
    queryKey: ['capas-publicas'],
    queryFn: () => api.get('/api/capas/publicas'),
    staleTime: 5 * 60_000, // 5 minutos
  })

  /**
   * Activa o desactiva una capa en el mapa.
   * @param {string} id - ID de la capa
   */
  const toggleCapa = useCallback((id) => {
    setIdsActivos((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(id)) {
        siguiente.delete(id)
      } else {
        siguiente.add(id)
      }
      return siguiente
    })
  }, [])

  /**
   * Cambia la opacidad de una capa.
   * @param {string} id    - ID de la capa
   * @param {number} valor - Valor entre 0 y 1
   */
  const setOpacidad = useCallback((id, valor) => {
    const valorAcotado = Math.max(0, Math.min(1, valor))
    setOpacidadesMap((prev) => ({ ...prev, [id]: valorAcotado }))
  }, [])

  /**
   * Indica si una capa está activa.
   * @param {string} id
   * @returns {boolean}
   */
  const estaActiva = useCallback((id) => idsActivos.has(id), [idsActivos])

  // Lista de capas activas con su opacidad inyectada
  const capasActivas = capas
    .filter((c) => idsActivos.has(c.id))
    .map((c) => ({
      ...c,
      opacidad: opacidades[c.id] ?? 1,
    }))

  return {
    capas,
    capasActivas,
    opacidades,
    cargando,
    error,
    toggleCapa,
    setOpacidad,
    estaActiva,
  }
}

export default useCapas
