/**
 * Página de administración de capas WMS del municipio.
 * Lista todas las capas (no solo públicas) y permite activarlas/desactivarlas.
 * Requiere autenticación con rol funcionario o superior.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api.js'
import Spinner from '../components/ui/Spinner.jsx'
import Badge from '../components/ui/Badge.jsx'

// Colores del toggle según estado
function ToggleActivo({ activo, onChange, id, nombre }) {
  return (
    <button
      role="switch"
      aria-checked={activo}
      aria-label={`${activo ? 'Desactivar' : 'Activar'} capa ${nombre}`}
      onClick={() => onChange(!activo)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
        focus-visible:ring-2 focus-visible:ring-municipal-500 focus-visible:ring-offset-1
        ${activo ? 'bg-municipal-600' : 'bg-gray-200'}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
          ${activo ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  )
}

// Fila de la tabla de capas
function FilaCapa({ capa, onToggleActivo }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{capa.nombre}</td>
      <td className="px-4 py-3">
        <Badge categoria={capa.categoria?.toLowerCase()} texto={capa.categoria} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 font-mono hidden md:table-cell">
        {capa.nombre_geoserver}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full
          ${capa.publica ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {capa.publica ? 'Pública' : 'Privada'}
        </span>
      </td>
      <td className="px-4 py-3">
        <ToggleActivo
          activo={capa.activa}
          nombre={capa.nombre}
          onChange={(nuevoValor) => onToggleActivo(capa.id, nuevoValor)}
        />
      </td>
    </tr>
  )
}

function AdminCapas() {
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const clienteQuery = useQueryClient()

  // Carga todas las capas del municipio (endpoint protegido)
  const {
    data: capas = [],
    isLoading: cargando,
    error,
  } = useQuery({
    queryKey: ['admin-capas'],
    queryFn: () => api.get('/api/admin/capas'),
    staleTime: 60_000,
  })

  // Mutación para toggle activa/inactiva
  const mutacionToggle = useMutation({
    mutationFn: ({ id, activa }) =>
      api.patch(`/api/admin/capas/${id}`, { activa }),
    onSuccess: () => {
      // Invalida el caché para refrescar la lista
      clienteQuery.invalidateQueries({ queryKey: ['admin-capas'] })
    },
  })

  function manejarToggle(id, activa) {
    mutacionToggle.mutate({ id, activa })
  }

  // Filtra por término de búsqueda
  const capasFiltradas = capas.filter((c) => {
    if (!terminoBusqueda) return true
    const termino = terminoBusqueda.toLowerCase()
    return (
      c.nombre?.toLowerCase().includes(termino) ||
      c.categoria?.toLowerCase().includes(termino) ||
      c.nombre_geoserver?.toLowerCase().includes(termino)
    )
  })

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Capas del municipio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {capas.length} capa{capas.length !== 1 ? 's' : ''} registrada{capas.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Campo de búsqueda */}
        <div className="relative w-full sm:w-64">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar capa…"
            value={terminoBusqueda}
            onChange={(e) => setTerminoBusqueda(e.target.value)}
            className="campo-texto pl-9"
            aria-label="Buscar capa por nombre o categoría"
          />
        </div>
      </div>

      {/* Estado de carga */}
      {cargando && (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
          <Spinner tamaño="lg" />
          <span>Cargando capas…</span>
        </div>
      )}

      {/* Error */}
      {error && !cargando && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          No se pudieron cargar las capas: {error.message}
        </div>
      )}

      {/* Tabla de capas */}
      {!cargando && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {capasFiltradas.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm">
              {terminoBusqueda ? `Sin resultados para "${terminoBusqueda}"` : 'No hay capas registradas.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Categoría
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide hidden md:table-cell">
                      GeoServer
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Visibilidad
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Activa
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {capasFiltradas.map((capa) => (
                    <FilaCapa
                      key={capa.id}
                      capa={capa}
                      onToggleActivo={manejarToggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Indicador de guardado */}
      {mutacionToggle.isPending && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          <Spinner tamaño="sm" />
          Guardando…
        </div>
      )}
    </div>
  )
}

export default AdminCapas
