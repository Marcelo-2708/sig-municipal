/**
 * Página de administración de usuarios del municipio.
 * Tabla con todos los usuarios, modal de creación/edición,
 * desactivación (soft delete) y reset de contraseña.
 * Requiere rol admin_municipal o superior.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api.js'
import Spinner from '../components/ui/Spinner.jsx'
import Modal from '../components/ui/Modal.jsx'

// ── Constantes ────────────────────────────────────────────────────────────

const ROLES = [
  { valor: 'funcionario',    etiqueta: 'Funcionario',    color: 'bg-gray-100 text-gray-700' },
  { valor: 'editor_gis',    etiqueta: 'Editor GIS',     color: 'bg-blue-100 text-blue-700' },
  { valor: 'admin_municipal', etiqueta: 'Admin Municipal', color: 'bg-purple-100 text-purple-700' },
]

const FORM_NUEVO = { nombre: '', email: '', rol: 'funcionario', contrasena: '' }

// ── Helpers ────────────────────────────────────────────────────────────────

function BadgeRol({ rol }) {
  const def = ROLES.find((r) => r.valor === rol)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${def?.color ?? 'bg-gray-100 text-gray-600'}`}>
      {def?.etiqueta ?? rol}
    </span>
  )
}

function BadgeEstado({ activo }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
      ${activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${activo ? 'bg-green-500' : 'bg-red-400'}`} aria-hidden="true" />
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

function formatearFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Fila de la tabla ──────────────────────────────────────────────────────

function FilaUsuario({ usuario, onEditar, onToggleEstado, onResetPassword, esYoMismo }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900">{usuario.nombre}</div>
        <div className="text-xs text-gray-400">{usuario.email}</div>
      </td>
      <td className="px-4 py-3">
        <BadgeRol rol={usuario.rol} />
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <BadgeEstado activo={usuario.activo} />
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
        {formatearFecha(usuario.ultimo_acceso)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          {/* Editar */}
          <button
            type="button"
            onClick={() => onEditar(usuario)}
            aria-label={`Editar ${usuario.nombre}`}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {/* Reset contraseña */}
          <button
            type="button"
            onClick={() => onResetPassword(usuario)}
            aria-label={`Resetear contraseña de ${usuario.nombre}`}
            className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </button>

          {/* Activar / Desactivar */}
          {!esYoMismo && (
            <button
              type="button"
              onClick={() => onToggleEstado(usuario)}
              aria-label={`${usuario.activo ? 'Desactivar' : 'Activar'} ${usuario.nombre}`}
              className={`p-1.5 rounded-lg transition-colors ${
                usuario.activo
                  ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
              }`}
            >
              {usuario.activo ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Modal formulario (crear / editar) ─────────────────────────────────────

function FormularioUsuario({ usuarioEditar, onExito, onCancelar }) {
  const esEdicion = Boolean(usuarioEditar)
  const [form, setForm] = useState(
    esEdicion
      ? { nombre: usuarioEditar.nombre, rol: usuarioEditar.rol }
      : FORM_NUEVO
  )
  const [errores, setErrores] = useState({})
  const clienteQuery = useQueryClient()

  const mutacion = useMutation({
    mutationFn: (datos) =>
      esEdicion
        ? api.put(`/api/admin/usuarios/${usuarioEditar.id}`, datos)
        : api.post('/api/admin/usuarios', datos),
    onSuccess: () => {
      clienteQuery.invalidateQueries({ queryKey: ['admin-usuarios'] })
      onExito()
    },
  })

  function actualizar(campo, valor) {
    setForm((p) => ({ ...p, [campo]: valor }))
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  function validar() {
    const e = {}
    if (!form.nombre?.trim()) e.nombre = 'El nombre es obligatorio'
    if (!esEdicion) {
      if (!form.email?.trim()) e.email = 'El email es obligatorio'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Formato de email inválido'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  function manejarEnvio(e) {
    e.preventDefault()
    if (!validar()) return
    const datos = esEdicion
      ? { nombre: form.nombre, rol: form.rol }
      : { nombre: form.nombre, email: form.email, rol: form.rol, contrasena: form.contrasena || undefined }
    mutacion.mutate(datos)
  }

  return (
    <form onSubmit={manejarEnvio} noValidate className="space-y-4">
      {/* Nombre */}
      <div>
        <label htmlFor="usu-nombre" className="etiqueta-campo">
          Nombre completo <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="usu-nombre"
          type="text"
          value={form.nombre}
          onChange={(e) => actualizar('nombre', e.target.value)}
          placeholder="Ej: Juan Pérez Soto"
          className={`campo-texto ${errores.nombre ? 'border-red-400' : ''}`}
          aria-invalid={!!errores.nombre}
          aria-describedby={errores.nombre ? 'err-nombre' : undefined}
        />
        {errores.nombre && (
          <p id="err-nombre" role="alert" className="mt-1 text-xs text-red-600">{errores.nombre}</p>
        )}
      </div>

      {/* Email (solo creación) */}
      {!esEdicion && (
        <div>
          <label htmlFor="usu-email" className="etiqueta-campo">
            Email <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input
            id="usu-email"
            type="email"
            value={form.email}
            onChange={(e) => actualizar('email', e.target.value)}
            placeholder="funcionario@municipio.cl"
            className={`campo-texto ${errores.email ? 'border-red-400' : ''}`}
            aria-invalid={!!errores.email}
            aria-describedby={errores.email ? 'err-email' : undefined}
          />
          {errores.email && (
            <p id="err-email" role="alert" className="mt-1 text-xs text-red-600">{errores.email}</p>
          )}
        </div>
      )}

      {/* Rol */}
      <div>
        <label htmlFor="usu-rol" className="etiqueta-campo">Rol</label>
        <select
          id="usu-rol"
          value={form.rol}
          onChange={(e) => actualizar('rol', e.target.value)}
          className="campo-texto"
        >
          {ROLES.map((r) => (
            <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">
          Funcionario: solo lectura · Editor GIS: publica capas · Admin Municipal: gestión completa
        </p>
      </div>

      {/* Contraseña inicial (solo creación, opcional) */}
      {!esEdicion && (
        <div>
          <label htmlFor="usu-pass" className="etiqueta-campo">
            Contraseña inicial
            <span className="ml-1 text-gray-400 font-normal">(opcional — se genera automáticamente)</span>
          </label>
          <input
            id="usu-pass"
            type="password"
            value={form.contrasena}
            onChange={(e) => actualizar('contrasena', e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className="campo-texto"
            autoComplete="new-password"
          />
        </div>
      )}

      {/* Error mutación */}
      {mutacion.isError && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {mutacion.error?.message ?? 'Error al guardar el usuario'}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secundario">
          Cancelar
        </button>
        <button type="submit" disabled={mutacion.isPending} className="btn-primario">
          {mutacion.isPending
            ? <span className="flex items-center gap-2"><Spinner tamaño="sm" />{esEdicion ? 'Guardando…' : 'Creando…'}</span>
            : esEdicion ? 'Guardar cambios' : 'Crear usuario'
          }
        </button>
      </div>
    </form>
  )
}

// ── Modal resultado reset contraseña ─────────────────────────────────────

function ModalContrasena({ contrasenaTemporal, nombreUsuario, onCerrar }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(contrasenaTemporal)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        Comunica esta contraseña temporal a <strong>{nombreUsuario}</strong>.
        Solo se muestra una vez.
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono tracking-wider text-gray-800 select-all">
          {contrasenaTemporal}
        </code>
        <button
          type="button"
          onClick={copiar}
          aria-label="Copiar contraseña"
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          {copiado ? (
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onCerrar} className="btn-primario">
          Entendido
        </button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────

function AdminUsuarios() {
  const [terminoBusqueda, setTerminoBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('')

  // Estado de modales
  const [modalUsuario, setModalUsuario] = useState(null) // null | 'nuevo' | <objeto usuario>
  const [modalContrasena, setModalContrasena] = useState(null) // null | { contrasenaTemporal, nombre }
  const [resetPendiente, setResetPendiente] = useState(null) // usuario sobre el que se hace reset

  const clienteQuery = useQueryClient()

  // Construir query string con filtros activos
  const params = new URLSearchParams()
  if (filtroRol)   params.set('rol', filtroRol)
  if (filtroActivo) params.set('activo', filtroActivo)

  const {
    data,
    isLoading: cargando,
    error,
  } = useQuery({
    queryKey: ['admin-usuarios', filtroRol, filtroActivo],
    queryFn: () => api.get(`/api/admin/usuarios?${params.toString()}`),
    staleTime: 30_000,
    select: (r) => r?.usuarios ?? [],
  })

  const usuarios = data ?? []

  // Mutación toggle estado
  const mutacionEstado = useMutation({
    mutationFn: ({ id, activo }) => api.patch(`/api/admin/usuarios/${id}/estado`, { activo }),
    onSuccess: () => clienteQuery.invalidateQueries({ queryKey: ['admin-usuarios'] }),
  })

  // Mutación reset contraseña
  const mutacionReset = useMutation({
    mutationFn: (id) => api.post(`/api/admin/usuarios/${id}/reset-password`),
    onSuccess: (datos) => {
      setModalContrasena({
        contrasenaTemporal: datos.contrasenaTemporal,
        nombre: resetPendiente?.nombre ?? 'el usuario',
      })
      setResetPendiente(null)
    },
  })

  function manejarToggleEstado(usuario) {
    mutacionEstado.mutate({ id: usuario.id, activo: !usuario.activo })
  }

  function manejarResetPassword(usuario) {
    setResetPendiente(usuario)
    mutacionReset.mutate(usuario.id)
  }

  // Filtro local por nombre o email
  const usuariosFiltrados = usuarios.filter((u) => {
    if (!terminoBusqueda) return true
    const t = terminoBusqueda.toLowerCase()
    return u.nombre?.toLowerCase().includes(t) || u.email?.toLowerCase().includes(t)
  })

  const totalActivos = usuarios.filter((u) => u.activo).length

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuarios del municipio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalActivos} activo{totalActivos !== 1 ? 's' : ''} de {usuarios.length} registrado{usuarios.length !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalUsuario('nuevo')}
          className="btn-primario whitespace-nowrap self-start sm:self-auto"
          aria-label="Crear nuevo usuario"
        >
          <svg className="w-4 h-4 mr-1.5 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por nombre o email…"
            value={terminoBusqueda}
            onChange={(e) => setTerminoBusqueda(e.target.value)}
            className="campo-texto pl-9"
            aria-label="Buscar usuario"
          />
        </div>

        <select
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
          className="campo-texto w-auto"
          aria-label="Filtrar por rol"
        >
          <option value="">Todos los roles</option>
          {ROLES.map((r) => (
            <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
          ))}
        </select>

        <select
          value={filtroActivo}
          onChange={(e) => setFiltroActivo(e.target.value)}
          className="campo-texto w-auto"
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {/* Carga */}
      {cargando && (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-500">
          <Spinner tamaño="lg" />
          <span>Cargando usuarios…</span>
        </div>
      )}

      {/* Error */}
      {error && !cargando && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          No se pudieron cargar los usuarios: {error.message}
        </div>
      )}

      {/* Tabla */}
      {!cargando && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {usuariosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {terminoBusqueda || filtroRol || filtroActivo
                ? 'Sin resultados para los filtros aplicados.'
                : (
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>No hay usuarios. Crea el primero con el botón "Nuevo usuario".</span>
                  </div>
                )
              }
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Usuario</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Rol</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide hidden sm:table-cell">Estado</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide hidden md:table-cell">Último acceso</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuariosFiltrados.map((usuario) => (
                    <FilaUsuario
                      key={usuario.id}
                      usuario={usuario}
                      onEditar={(u) => setModalUsuario(u)}
                      onToggleEstado={manejarToggleEstado}
                      onResetPassword={manejarResetPassword}
                      esYoMismo={false}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Toast guardando estado */}
      {(mutacionEstado.isPending || mutacionReset.isPending) && (
        <div role="status" aria-live="polite"
          className="fixed bottom-4 right-4 flex items-center gap-2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          <Spinner tamaño="sm" />
          {mutacionReset.isPending ? 'Generando contraseña…' : 'Guardando…'}
        </div>
      )}

      {/* Modal crear / editar */}
      <Modal
        abierto={modalUsuario !== null}
        onCerrar={() => setModalUsuario(null)}
        titulo={modalUsuario === 'nuevo' ? 'Nuevo usuario' : `Editar: ${modalUsuario?.nombre ?? ''}`}
      >
        {modalUsuario !== null && (
          <FormularioUsuario
            usuarioEditar={modalUsuario === 'nuevo' ? null : modalUsuario}
            onExito={() => setModalUsuario(null)}
            onCancelar={() => setModalUsuario(null)}
          />
        )}
      </Modal>

      {/* Modal contraseña temporal (reset) */}
      <Modal
        abierto={modalContrasena !== null}
        onCerrar={() => setModalContrasena(null)}
        titulo="Contraseña temporal generada"
      >
        {modalContrasena && (
          <ModalContrasena
            contrasenaTemporal={modalContrasena.contrasenaTemporal}
            nombreUsuario={modalContrasena.nombre}
            onCerrar={() => setModalContrasena(null)}
          />
        )}
      </Modal>
    </div>
  )
}

export default AdminUsuarios
