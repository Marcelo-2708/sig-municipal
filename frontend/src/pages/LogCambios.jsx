import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api.js'
import useAuth from '../hooks/useAuth.js'

// ── Constantes ────────────────────────────────────────────────────────────────

const TABLAS = [
  { valor: '',                    etiqueta: 'Todas las tablas' },
  { valor: 'capas',               etiqueta: 'Capas' },
  { valor: 'usuarios',            etiqueta: 'Usuarios' },
  { valor: 'municipios',          etiqueta: 'Municipios' },
  { valor: 'reportes_ciudadanos', etiqueta: 'Reportes ciudadanos' },
]

const OPERACIONES = [
  { valor: '',        etiqueta: 'Todas las operaciones' },
  { valor: 'INSERT',  etiqueta: 'Creación (INSERT)' },
  { valor: 'UPDATE',  etiqueta: 'Modificación (UPDATE)' },
  { valor: 'DELETE',  etiqueta: 'Eliminación (DELETE)' },
  { valor: 'LOGIN',   etiqueta: 'Inicio de sesión' },
  { valor: 'LOGOUT',  etiqueta: 'Cierre de sesión' },
  { valor: 'ERROR',   etiqueta: 'Error' },
]

// ── Helpers visuales ──────────────────────────────────────────────────────────

const COLORES_OPERACION = {
  INSERT: 'bg-green-100  text-green-800',
  UPDATE: 'bg-blue-100   text-blue-800',
  DELETE: 'bg-red-100    text-red-800',
  LOGIN:  'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-gray-100   text-gray-700',
  ERROR:  'bg-red-200    text-red-900',
}

const COLORES_TABLA = {
  capas:               'bg-sky-100     text-sky-800',
  usuarios:            'bg-violet-100  text-violet-800',
  municipios:          'bg-orange-100  text-orange-800',
  reportes_ciudadanos: 'bg-teal-100    text-teal-800',
}

function BadgeOperacion({ op }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${COLORES_OPERACION[op] ?? 'bg-gray-100 text-gray-700'}`}>
      {op}
    </span>
  )
}

function BadgeTabla({ tabla }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${COLORES_TABLA[tabla] ?? 'bg-gray-100 text-gray-600'}`}>
      {tabla}
    </span>
  )
}

function formatearFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ── Componente de diff JSON ───────────────────────────────────────────────────

function DiffJson({ entrada }) {
  const tieneAnterior = entrada.datos_anteriores !== null
  const tieneNuevos   = entrada.datos_nuevos     !== null

  if (!tieneAnterior && !tieneNuevos) {
    return <p className="text-sm text-gray-400 italic px-4 py-3">Sin datos de cambio registrados.</p>
  }

  const formatear = (obj) => {
    if (obj === null || obj === undefined) return null
    try {
      const parsed = typeof obj === 'string' ? JSON.parse(obj) : obj
      return JSON.stringify(parsed, null, 2)
    } catch {
      return String(obj)
    }
  }

  return (
    <div className="grid grid-cols-2 divide-x divide-gray-200 text-xs">
      <div className="p-4">
        <p className="font-semibold text-gray-500 mb-2 uppercase tracking-wide text-[10px]">
          Antes
        </p>
        {tieneAnterior
          ? <pre className="whitespace-pre-wrap break-all text-red-700 bg-red-50 rounded p-2 leading-relaxed">
              {formatear(entrada.datos_anteriores)}
            </pre>
          : <p className="text-gray-400 italic">—</p>
        }
      </div>
      <div className="p-4">
        <p className="font-semibold text-gray-500 mb-2 uppercase tracking-wide text-[10px]">
          Después
        </p>
        {tieneNuevos
          ? <pre className="whitespace-pre-wrap break-all text-green-700 bg-green-50 rounded p-2 leading-relaxed">
              {formatear(entrada.datos_nuevos)}
            </pre>
          : <p className="text-gray-400 italic">—</p>
        }
      </div>
    </div>
  )
}

// ── Fila de la tabla ──────────────────────────────────────────────────────────

function FilaLog({ entrada }) {
  const [expandida, setExpandida] = useState(false)

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
          {formatearFecha(entrada.creado_en)}
        </td>
        <td className="px-4 py-3 text-sm text-gray-800">
          {entrada.usuario_email
            ? <div>
                <p className="font-medium leading-tight">{entrada.usuario_nombre}</p>
                <p className="text-xs text-gray-400">{entrada.usuario_email}</p>
              </div>
            : <span className="text-gray-400 italic text-xs">Sistema</span>
          }
        </td>
        <td className="px-4 py-3">
          <BadgeTabla tabla={entrada.tabla_afectada} />
        </td>
        <td className="px-4 py-3">
          <BadgeOperacion op={entrada.operacion} />
        </td>
        <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={entrada.descripcion}>
          {entrada.descripcion || '—'}
        </td>
        <td className="px-4 py-3 text-right">
          {(entrada.datos_anteriores !== null || entrada.datos_nuevos !== null) && (
            <button
              onClick={() => setExpandida((v) => !v)}
              aria-expanded={expandida}
              className="text-xs text-municipal-700 hover:underline font-medium"
            >
              {expandida ? 'Ocultar' : 'Ver diff'}
            </button>
          )}
        </td>
      </tr>
      {expandida && (
        <tr className="bg-gray-50 border-t border-gray-100">
          <td colSpan={6} className="border-b border-gray-200">
            <DiffJson entrada={entrada} />
          </td>
        </tr>
      )}
    </>
  )
}

// ── Paginación ────────────────────────────────────────────────────────────────

function Paginacion({ pagina, paginas, onChange }) {
  if (paginas <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <button
        disabled={pagina <= 1}
        onClick={() => onChange(pagina - 1)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
      >
        ← Anterior
      </button>
      <span className="text-sm text-gray-600">
        Página {pagina} de {paginas}
      </span>
      <button
        disabled={pagina >= paginas}
        onClick={() => onChange(pagina + 1)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
      >
        Siguiente →
      </button>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

const FILTROS_INIT = { tabla: '', operacion: '', fechaDesde: '', fechaHasta: '' }

function LogCambios() {
  const { tienePermiso } = useAuth()

  const [filtros, setFiltros] = useState(FILTROS_INIT)
  const [pagina, setPagina]   = useState(1)
  const [descargando, setDescargando] = useState(false)

  const queryParams = Object.fromEntries(
    Object.entries({ ...filtros, pagina, limite: 50 }).filter(([, v]) => v !== '' && v !== undefined)
  )

  const { data, isLoading, isError } = useQuery({
    queryKey: ['log', queryParams],
    queryFn:  () => api.get('/api/admin/log', { params: queryParams }),
    keepPreviousData: true,
  })

  const cambiarFiltro = useCallback((campo, valor) => {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina(1)
  }, [])

  async function descargarCsv() {
    setDescargando(true)
    try {
      const params = new URLSearchParams(
        Object.entries(filtros).filter(([, v]) => v !== '')
      ).toString()
      const url = `/api/admin/log/exportar${params ? '?' + params : ''}`

      // Usar fetch directo para obtener el blob
      const { default: useAuthStore } = await import('../store/authStore.js')
      const token = useAuthStore.getState().token
      const res = await fetch(url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL}${url}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Error al descargar el CSV')

      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = href
      a.download = 'log_cambios.csv'
      a.click()
      URL.revokeObjectURL(href)
    } catch (err) {
      console.error('Error al descargar CSV:', err)
    } finally {
      setDescargando(false)
    }
  }

  if (!tienePermiso('admin_municipal')) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <p className="text-gray-500 text-sm">Acceso restringido a administradores.</p>
      </div>
    )
  }

  const entradas = data?.entradas ?? []
  const total    = data?.total    ?? 0
  const paginas  = data?.paginas  ?? 1

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Log de cambios</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Auditoría de operaciones — {total.toLocaleString('es-CL')} {total === 1 ? 'entrada' : 'entradas'}
          </p>
        </div>
        <button
          onClick={descargarCsv}
          disabled={descargando || total === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg
                     hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {descargando ? 'Descargando…' : 'Exportar CSV'}
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3">
        <select
          value={filtros.tabla}
          onChange={(e) => cambiarFiltro('tabla', e.target.value)}
          className="campo-texto text-sm w-48"
          aria-label="Filtrar por tabla"
        >
          {TABLAS.map((t) => (
            <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
          ))}
        </select>

        <select
          value={filtros.operacion}
          onChange={(e) => cambiarFiltro('operacion', e.target.value)}
          className="campo-texto text-sm w-52"
          aria-label="Filtrar por operación"
        >
          {OPERACIONES.map((o) => (
            <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label htmlFor="fechaDesde" className="text-sm text-gray-600 whitespace-nowrap">Desde</label>
          <input
            id="fechaDesde"
            type="date"
            value={filtros.fechaDesde}
            onChange={(e) => cambiarFiltro('fechaDesde', e.target.value)}
            className="campo-texto text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="fechaHasta" className="text-sm text-gray-600 whitespace-nowrap">Hasta</label>
          <input
            id="fechaHasta"
            type="date"
            value={filtros.fechaHasta}
            onChange={(e) => cambiarFiltro('fechaHasta', e.target.value)}
            className="campo-texto text-sm"
          />
        </div>

        {(filtros.tabla || filtros.operacion || filtros.fechaDesde || filtros.fechaHasta) && (
          <button
            onClick={() => { setFiltros(FILTROS_INIT); setPagina(1) }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <svg className="w-6 h-6 animate-spin text-municipal-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : isError ? (
          <div className="text-center py-16">
            <p className="text-red-600 text-sm">Error al cargar el log. Intenta nuevamente.</p>
          </div>
        ) : entradas.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 text-sm">Sin entradas para los filtros seleccionados.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Fecha / Hora', 'Usuario', 'Tabla', 'Operación', 'Descripción', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100" aria-live="polite">
                  {entradas.map((e) => (
                    <FilaLog key={e.id} entrada={e} />
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacion pagina={pagina} paginas={paginas} onChange={setPagina} />
          </>
        )}
      </div>
    </div>
  )
}

export default LogCambios
