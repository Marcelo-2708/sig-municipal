/**
 * Página de administración de capas WMS/WFS del municipio.
 * Permite activar/desactivar, reordenar (drag & drop) y publicar nuevas capas.
 * Requiere autenticación con rol editor_gis o superior.
 */

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api.js'
import Spinner from '../components/ui/Spinner.jsx'
import Badge from '../components/ui/Badge.jsx'
import Modal from '../components/ui/Modal.jsx'

// ── Constantes ────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { valor: 'catastro',       etiqueta: 'Catastro' },
  { valor: 'infraestructura', etiqueta: 'Infraestructura' },
  { valor: 'urbanismo',      etiqueta: 'Urbanismo' },
  { valor: 'ambiente',       etiqueta: 'Ambiente' },
  { valor: 'transporte',     etiqueta: 'Transporte' },
  { valor: 'servicios',      etiqueta: 'Servicios' },
  { valor: 'riesgos',        etiqueta: 'Riesgos' },
  { valor: 'patrimonio',     etiqueta: 'Patrimonio' },
  { valor: 'salud',          etiqueta: 'Salud' },
  { valor: 'educacion',      etiqueta: 'Educación' },
]

const TIPOS_CAPA = [
  { valor: 'wms',     etiqueta: 'WMS (vectorial/raster vía GeoServer)' },
  { valor: 'wfs',     etiqueta: 'WFS (vectorial con datos)' },
  { valor: 'geojson', etiqueta: 'GeoJSON (estático)' },
  { valor: 'raster',  etiqueta: 'Raster (imagen georreferenciada)' },
]

const FORM_INICIAL = {
  nombre:           '',
  nombreInterno:    '',
  nombreTabla:      '',
  tipo:             'wms',
  categoria:        '',
  descripcion:      '',
  estiloPorDefecto: '',
  visiblePorDefecto: false,
  orden:            0,
}

// ── Sub-componentes ───────────────────────────────────────────────────────

function ToggleActivo({ activo, onChange, nombre }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={`${activo ? 'Desactivar' : 'Activar'} capa ${nombre}`}
      onClick={() => onChange(!activo)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
        focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
        ${activo ? 'bg-blue-600' : 'bg-gray-200'}
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

function FilaCapa({ capa, onToggleActivo, onDragStart, onDragOver, onDrop, onDragEnd, arrastrando }) {
  return (
    <tr
      draggable
      onDragStart={() => onDragStart(capa.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(capa.id) }}
      onDrop={() => onDrop(capa.id)}
      onDragEnd={onDragEnd}
      className={`
        hover:bg-gray-50 transition-colors cursor-grab active:cursor-grabbing
        ${arrastrando ? 'opacity-40' : 'opacity-100'}
      `}
    >
      {/* Asa de arrastre */}
      <td className="px-3 py-3 text-gray-300" aria-hidden="true">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 110 4 2 2 0 010-4zm6 0a2 2 0 110 4 2 2 0 010-4zM7 8a2 2 0 110 4 2 2 0 010-4zm6 0a2 2 0 110 4 2 2 0 010-4zM7 14a2 2 0 110 4 2 2 0 010-4zm6 0a2 2 0 110 4 2 2 0 010-4z" />
        </svg>
      </td>

      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900">{capa.nombre}</div>
        <div className="text-xs text-gray-400 font-mono mt-0.5">{capa.nombre_interno}</div>
      </td>

      <td className="px-4 py-3">
        {capa.categoria
          ? <Badge categoria={capa.categoria} texto={capa.categoria} />
          : <span className="text-xs text-gray-400">—</span>
        }
      </td>

      <td className="px-4 py-3 hidden md:table-cell">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 font-mono uppercase">
          {capa.tipo}
        </span>
      </td>

      <td className="px-4 py-3 hidden lg:table-cell">
        <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full
          ${capa.visible_por_defecto ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {capa.visible_por_defecto ? 'Pública' : 'Privada'}
        </span>
      </td>

      <td className="px-4 py-3">
        <ToggleActivo
          activo={capa.activo}
          nombre={capa.nombre}
          onChange={(nuevoValor) => onToggleActivo(capa.id, nuevoValor)}
        />
      </td>
    </tr>
  )
}

// ── Formulario nueva capa ─────────────────────────────────────────────────

function FormularioCapa({ onExito, onCancelar }) {
  const [form, setForm] = useState(FORM_INICIAL)
  const [previsualizando, setPrevisualizando] = useState(false)
  const [errores, setErrores] = useState({})
  const clienteQuery = useQueryClient()

  const mutacion = useMutation({
    mutationFn: (datos) => api.post('/api/admin/capas/publicar', datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['admin-capas'] })
      onExito()
    },
  })

  function actualizar(campo, valor) {
    setForm((prev) => {
      const siguiente = { ...prev, [campo]: valor }
      // Auto-generar nombreInterno desde nombre si el usuario no lo ha tocado
      if (campo === 'nombre' && !prev._nombreInternoManual) {
        siguiente.nombreInterno = slugify(valor)
      }
      if (campo === 'nombreInterno') {
        siguiente._nombreInternoManual = true
      }
      return siguiente
    })
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  function validar() {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio'
    if (!form.nombreInterno.trim()) e.nombreInterno = 'El identificador es obligatorio'
    if (!/^[a-z0-9_]+$/.test(form.nombreInterno)) {
      e.nombreInterno = 'Solo letras minúsculas, números y guiones bajos'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  function manejarEnvio(e) {
    e.preventDefault()
    if (!validar()) return
    const { _nombreInternoManual, ...datos } = form
    mutacion.mutate(datos)
  }

  // URL de previsualización WMS con bounding box de Chile
  const urlPreview = form.nombre_interno
    ? `${import.meta.env.VITE_GEOSERVER_URL}/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
      `&LAYERS=${form.nombreInterno}&FORMAT=image/png&TRANSPARENT=true` +
      `&SRS=EPSG:4326&WIDTH=256&HEIGHT=256&BBOX=-75,-56,-65,-17`
    : null

  return (
    <form onSubmit={manejarEnvio} noValidate className="space-y-4">
      {/* Nombre visible */}
      <div>
        <label htmlFor="cap-nombre" className="etiqueta-campo">
          Nombre visible <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id="cap-nombre"
          type="text"
          value={form.nombre}
          onChange={(e) => actualizar('nombre', e.target.value)}
          placeholder="Ej: Predios Catastro 2026"
          className={`campo-texto ${errores.nombre ? 'border-red-400' : ''}`}
          aria-describedby={errores.nombre ? 'err-nombre' : undefined}
          aria-invalid={!!errores.nombre}
        />
        {errores.nombre && (
          <p id="err-nombre" role="alert" className="mt-1 text-xs text-red-600">{errores.nombre}</p>
        )}
      </div>

      {/* Identificador GeoServer */}
      <div>
        <label htmlFor="cap-interno" className="etiqueta-campo">
          Identificador (GeoServer) <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id="cap-interno"
          type="text"
          value={form.nombreInterno}
          onChange={(e) => actualizar('nombreInterno', e.target.value.toLowerCase())}
          placeholder="Ej: predios_catastro_2026"
          className={`campo-texto font-mono text-sm ${errores.nombreInterno ? 'border-red-400' : ''}`}
          aria-describedby={errores.nombreInterno ? 'err-interno' : 'hint-interno'}
          aria-invalid={!!errores.nombreInterno}
        />
        <p id="hint-interno" className="mt-1 text-xs text-gray-400">
          Solo letras minúsculas, números y guiones bajos
        </p>
        {errores.nombreInterno && (
          <p id="err-interno" role="alert" className="mt-1 text-xs text-red-600">{errores.nombreInterno}</p>
        )}
      </div>

      {/* Tipo y categoría en fila */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="cap-tipo" className="etiqueta-campo">Tipo</label>
          <select
            id="cap-tipo"
            value={form.tipo}
            onChange={(e) => actualizar('tipo', e.target.value)}
            className="campo-texto"
          >
            {TIPOS_CAPA.map((t) => (
              <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="cap-categoria" className="etiqueta-campo">Categoría</label>
          <select
            id="cap-categoria"
            value={form.categoria}
            onChange={(e) => actualizar('categoria', e.target.value)}
            className="campo-texto"
          >
            <option value="">Sin categoría</option>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla PostGIS */}
      <div>
        <label htmlFor="cap-tabla" className="etiqueta-campo">Tabla PostGIS</label>
        <input
          id="cap-tabla"
          type="text"
          value={form.nombreTabla}
          onChange={(e) => actualizar('nombreTabla', e.target.value.toLowerCase())}
          placeholder="Ej: predios"
          className="campo-texto font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">
          Nombre de la tabla en el esquema del municipio. Dejar vacío si se usa URL directa.
        </p>
      </div>

      {/* Estilo SLD y orden en fila */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="cap-estilo" className="etiqueta-campo">Estilo SLD</label>
          <input
            id="cap-estilo"
            type="text"
            value={form.estiloPorDefecto}
            onChange={(e) => actualizar('estiloPorDefecto', e.target.value)}
            placeholder="Ej: predios_default"
            className="campo-texto font-mono text-sm"
          />
        </div>

        <div>
          <label htmlFor="cap-orden" className="etiqueta-campo">Orden</label>
          <input
            id="cap-orden"
            type="number"
            min="0"
            value={form.orden}
            onChange={(e) => actualizar('orden', parseInt(e.target.value, 10) || 0)}
            className="campo-texto"
          />
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label htmlFor="cap-desc" className="etiqueta-campo">Descripción</label>
        <textarea
          id="cap-desc"
          rows={2}
          value={form.descripcion}
          onChange={(e) => actualizar('descripcion', e.target.value)}
          placeholder="Descripción breve de la capa…"
          className="campo-texto resize-none"
        />
      </div>

      {/* Visible por defecto */}
      <div className="flex items-center gap-3">
        <input
          id="cap-publica"
          type="checkbox"
          checked={form.visiblePorDefecto}
          onChange={(e) => actualizar('visiblePorDefecto', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="cap-publica" className="text-sm text-gray-700 cursor-pointer">
          Visible al público por defecto (sin autenticación)
        </label>
      </div>

      {/* Previsualización WMS */}
      {form.nombreInterno && (
        <div>
          <button
            type="button"
            onClick={() => setPrevisualizando(!previsualizando)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {previsualizando ? 'Ocultar vista previa' : 'Previsualizar capa en GeoServer'}
          </button>
          {previsualizando && (
            <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center h-40">
              <img
                src={`${import.meta.env.VITE_GEOSERVER_URL}/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${form.nombreInterno}&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:4326&WIDTH=320&HEIGHT=160&BBOX=-75,-56,-65,-17`}
                alt={`Vista previa de ${form.nombre || form.nombreInterno}`}
                className="max-h-full max-w-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'flex'
                }}
              />
              <div className="hidden flex-col items-center gap-1 text-gray-400 text-xs">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4" />
                </svg>
                <span>La capa no está publicada aún en GeoServer</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error de la mutación */}
      {mutacion.isError && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {mutacion.error?.message ?? 'Error al publicar la capa'}
        </div>
      )}

      {/* Acciones */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancelar}
          className="btn-secundario"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={mutacion.isPending}
          className="btn-primario"
        >
          {mutacion.isPending ? (
            <span className="flex items-center gap-2"><Spinner tamaño="sm" /> Publicando…</span>
          ) : 'Publicar capa'}
        </button>
      </div>
    </form>
  )
}

// ── Página principal ──────────────────────────────────────────────────────

function AdminCapas() {
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [listaLocal, setListaLocal] = useState(null) // null = usar datos del servidor
  const clienteQuery = useQueryClient()

  // Drag & drop state
  const dragItemId = useRef(null)
  const dragOverItemId = useRef(null)

  const {
    data,
    isLoading: cargando,
    error,
  } = useQuery({
    queryKey: ['admin-capas'],
    queryFn: () => api.get('/api/admin/capas'),
    staleTime: 60_000,
    select: (respuesta) => respuesta?.capas ?? [],
  })

  const capas = listaLocal ?? data ?? []

  // Toggle activo/inactivo
  const mutacionToggle = useMutation({
    mutationFn: ({ id, activo }) => api.patch(`/api/admin/capas/${id}`, { activo }),
    onSuccess: () => {
      setListaLocal(null)
      clienteQuery.invalidateQueries({ queryKey: ['admin-capas'] })
    },
  })

  // Reordenar capas
  const mutacionOrden = useMutation({
    mutationFn: (items) => api.patch('/api/admin/capas/orden', { capas: items }),
    onError: () => {
      setListaLocal(null)
      clienteQuery.invalidateQueries({ queryKey: ['admin-capas'] })
    },
  })

  function manejarToggle(id, activo) {
    // Optimistic update
    setListaLocal((prev) =>
      (prev ?? capas).map((c) => (c.id === id ? { ...c, activo } : c))
    )
    mutacionToggle.mutate({ id, activo })
  }

  // ── Drag & drop handlers ─────────────────────────────────────────────

  function alIniciarArrastre(id) {
    dragItemId.current = id
  }

  function alArrastrarSobre(id) {
    dragOverItemId.current = id
  }

  function alSoltar() {
    const origenId = dragItemId.current
    const destinoId = dragOverItemId.current
    if (!origenId || !destinoId || origenId === destinoId) return

    const lista = [...capas]
    const origenIdx = lista.findIndex((c) => c.id === origenId)
    const destinoIdx = lista.findIndex((c) => c.id === destinoId)

    const [movido] = lista.splice(origenIdx, 1)
    lista.splice(destinoIdx, 0, movido)

    // Reasignar órdenes de forma continua
    const nuevaLista = lista.map((c, i) => ({ ...c, orden: i }))
    setListaLocal(nuevaLista)

    mutacionOrden.mutate(nuevaLista.map(({ id, orden }) => ({ id, orden })))
  }

  function alTerminarArrastre() {
    dragItemId.current = null
    dragOverItemId.current = null
  }

  // ── Filtrado ─────────────────────────────────────────────────────────

  const capasFiltradas = capas.filter((c) => {
    if (!terminoBusqueda) return true
    const t = terminoBusqueda.toLowerCase()
    return (
      c.nombre?.toLowerCase().includes(t) ||
      c.nombre_interno?.toLowerCase().includes(t) ||
      c.categoria?.toLowerCase().includes(t) ||
      c.tipo?.toLowerCase().includes(t)
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

        <div className="flex items-center gap-3">
          {/* Buscador */}
          <div className="relative w-full sm:w-56">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
              aria-hidden="true"
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
              aria-label="Buscar capa por nombre, tipo o categoría"
            />
          </div>

          {/* Nueva capa */}
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="btn-primario whitespace-nowrap"
            aria-label="Publicar nueva capa"
          >
            <svg className="w-4 h-4 mr-1.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva capa
          </button>
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
            <div className="text-center py-12 text-gray-500 text-sm">
              {terminoBusqueda
                ? `Sin resultados para "${terminoBusqueda}"`
                : (
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4" />
                    </svg>
                    <span>No hay capas registradas. Publica la primera con el botón "Nueva capa".</span>
                  </div>
                )
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 w-8" aria-label="Arrastrar para reordenar" />
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Categoría
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide hidden md:table-cell">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide hidden lg:table-cell">
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
                      onDragStart={alIniciarArrastre}
                      onDragOver={alArrastrarSobre}
                      onDrop={alSoltar}
                      onDragEnd={alTerminarArrastre}
                      arrastrando={dragItemId.current === capa.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Indicador de reordenado */}
          {mutacionOrden.isPending && (
            <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 text-xs text-blue-600 flex items-center gap-2">
              <Spinner tamaño="sm" />
              Guardando nuevo orden…
            </div>
          )}
        </div>
      )}

      {/* Toast de guardado toggle */}
      {mutacionToggle.isPending && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 flex items-center gap-2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50"
        >
          <Spinner tamaño="sm" />
          Guardando…
        </div>
      )}

      {/* Modal nueva capa */}
      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo="Publicar nueva capa"
        className="max-w-lg"
      >
        <FormularioCapa
          onExito={() => setModalAbierto(false)}
          onCancelar={() => setModalAbierto(false)}
        />
      </Modal>
    </div>
  )
}

export default AdminCapas

// ── Helper ────────────────────────────────────────────────────────────────

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 63)
}
