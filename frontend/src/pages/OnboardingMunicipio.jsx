import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../services/api.js'
import useAuth from '../hooks/useAuth.js'
import Spinner from '../components/ui/Spinner.jsx'

const PLANES = [
  { valor: 'basico',   etiqueta: 'Básico',   desc: 'Hasta 5 capas, 10 usuarios' },
  { valor: 'estandar', etiqueta: 'Estándar', desc: 'Hasta 20 capas, 50 usuarios' },
  { valor: 'premium',  etiqueta: 'Premium',  desc: 'Capas y usuarios ilimitados' },
]

function slugificar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

function subdominioDesdeCodigo(codigo) {
  return codigo.replace(/_/g, '-')
}

function AlertaAdvertencia({ texto }) {
  return (
    <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd" />
      </svg>
      <span>{texto}</span>
    </div>
  )
}

function BadgePlan({ plan }) {
  const colores = {
    basico:   'bg-gray-100 text-gray-700',
    estandar: 'bg-blue-100 text-blue-700',
    premium:  'bg-purple-100 text-purple-700',
  }
  const etiquetas = { basico: 'Básico', estandar: 'Estándar', premium: 'Premium' }
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colores[plan] ?? colores.basico}`}>
      {etiquetas[plan] ?? plan}
    </span>
  )
}

function ResultadoExito({ municipio, advertencias, onNuevo }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-green-900">Municipio creado exitosamente</p>
          <p className="text-sm text-green-700">{municipio.nombre}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 text-sm">
        {[
          ['ID',        municipio.id],
          ['Código',    municipio.codigo],
          ['Subdominio', municipio.subdominio],
          ['Esquema BD', municipio.esquema_bd],
          ['Plan',      <BadgePlan key="plan" plan={municipio.plan} />],
          ['Región',    municipio.region || '—'],
          ['Provincia', municipio.provincia || '—'],
        ].map(([label, valor]) => (
          <div key={label} className="flex items-center px-4 py-2.5 gap-4">
            <span className="w-28 text-gray-500 shrink-0">{label}</span>
            <span className="font-mono text-gray-900 break-all">{valor}</span>
          </div>
        ))}
      </div>

      {advertencias.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-amber-700">Acciones manuales pendientes:</p>
          {advertencias.map((a, i) => (
            <AlertaAdvertencia key={i} texto={a} />
          ))}
        </div>
      )}

      <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <strong>Siguiente paso:</strong> agregar el subdominio{' '}
        <code className="font-mono text-xs bg-white px-1 border border-gray-300 rounded">
          {municipio.subdominio}.{'{dominio_base}'}
        </code>{' '}
        al archivo <code className="font-mono text-xs">hosts</code> o DNS, luego crear el
        usuario administrador del municipio en la sección{' '}
        <Link to="/admin/usuarios" className="text-municipal-700 hover:underline">Usuarios</Link>.
      </p>

      <button onClick={onNuevo} className="btn-primario w-full">
        Crear otro municipio
      </button>
    </div>
  )
}

function OnboardingMunicipio() {
  const { tienePermiso } = useAuth()

  const [form, setForm] = useState({
    nombre:     '',
    codigo:     '',
    subdominio: '',
    region:     '',
    provincia:  '',
    plan:       'basico',
  })
  const [codigoManual, setCodigoManual]         = useState(false)
  const [subdominioManual, setSubdominioManual] = useState(false)

  const mutacion = useMutation({
    mutationFn: (datos) => api.post('/api/superadmin/municipios', datos),
  })

  if (!tienePermiso('super_admin')) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <p className="text-gray-500 text-sm">Acceso restringido a super_admin.</p>
      </div>
    )
  }

  if (mutacion.isSuccess) {
    return (
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo municipio</h1>
        <ResultadoExito
          municipio={mutacion.data.municipio}
          advertencias={mutacion.data.advertencias ?? []}
          onNuevo={() => {
            mutacion.reset()
            setForm({ nombre: '', codigo: '', subdominio: '', region: '', provincia: '', plan: 'basico' })
            setCodigoManual(false)
            setSubdominioManual(false)
          }}
        />
      </div>
    )
  }

  function actualizarNombre(valor) {
    const slug = slugificar(valor)
    setForm((f) => ({
      ...f,
      nombre:     valor,
      codigo:     codigoManual     ? f.codigo     : slug,
      subdominio: subdominioManual ? f.subdominio : subdominioDesdeCodigo(slug),
    }))
  }

  function actualizarCodigo(valor) {
    setCodigoManual(true)
    setForm((f) => ({
      ...f,
      codigo:     valor,
      subdominio: subdominioManual ? f.subdominio : subdominioDesdeCodigo(valor),
    }))
  }

  function campo(nombre, valor) {
    setForm((f) => ({ ...f, [nombre]: valor }))
  }

  async function manejarEnvio(e) {
    e.preventDefault()
    mutacion.mutate(form)
  }

  const estaEnviando = mutacion.isPending

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo municipio</h1>
        <p className="text-sm text-gray-500 mt-1">
          Provisiona un nuevo tenant: crea el esquema PostgreSQL, las tablas espaciales y el
          workspace GeoServer en un solo paso.
        </p>
      </div>

      <form onSubmit={manejarEnvio} noValidate className="space-y-5">

        {/* Error global */}
        {mutacion.isError && (
          <div role="alert" className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd" />
            </svg>
            <span>{mutacion.error?.message ?? 'Error al crear el municipio.'}</span>
          </div>
        )}

        {/* Nombre */}
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre oficial <span className="text-red-500">*</span>
          </label>
          <input
            id="nombre"
            type="text"
            required
            disabled={estaEnviando}
            value={form.nombre}
            onChange={(e) => actualizarNombre(e.target.value)}
            placeholder="Municipalidad de Concepción"
            className="campo-texto"
          />
        </div>

        {/* Código + Subdominio */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="codigo" className="block text-sm font-medium text-gray-700 mb-1">
              Código <span className="text-red-500">*</span>
            </label>
            <input
              id="codigo"
              type="text"
              required
              disabled={estaEnviando}
              value={form.codigo}
              onChange={(e) => actualizarCodigo(e.target.value.toLowerCase())}
              placeholder="concepcion"
              className="campo-texto font-mono text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Esquema: <code>mun_{form.codigo || '…'}</code></p>
          </div>
          <div>
            <label htmlFor="subdominio" className="block text-sm font-medium text-gray-700 mb-1">
              Subdominio <span className="text-red-500">*</span>
            </label>
            <input
              id="subdominio"
              type="text"
              required
              disabled={estaEnviando}
              value={form.subdominio}
              onChange={(e) => {
                setSubdominioManual(true)
                campo('subdominio', e.target.value.toLowerCase())
              }}
              placeholder="concepcion"
              className="campo-texto font-mono text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">URL: <code>{form.subdominio || '…'}.sig.municipalidad.cl</code></p>
          </div>
        </div>

        {/* Región + Provincia */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
              Región
            </label>
            <input
              id="region"
              type="text"
              disabled={estaEnviando}
              value={form.region}
              onChange={(e) => campo('region', e.target.value)}
              placeholder="Región del Biobío"
              className="campo-texto"
            />
          </div>
          <div>
            <label htmlFor="provincia" className="block text-sm font-medium text-gray-700 mb-1">
              Provincia
            </label>
            <input
              id="provincia"
              type="text"
              disabled={estaEnviando}
              value={form.provincia}
              onChange={(e) => campo('provincia', e.target.value)}
              placeholder="Concepción"
              className="campo-texto"
            />
          </div>
        </div>

        {/* Plan */}
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Plan</p>
          <div className="grid grid-cols-3 gap-3">
            {PLANES.map(({ valor, etiqueta, desc }) => (
              <label
                key={valor}
                className={`cursor-pointer rounded-lg border-2 p-3 text-center transition-colors ${
                  form.plan === valor
                    ? 'border-municipal-600 bg-municipal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={valor}
                  checked={form.plan === valor}
                  onChange={() => campo('plan', valor)}
                  disabled={estaEnviando}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-gray-900">{etiqueta}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Aviso tiempo */}
        <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd" />
          </svg>
          <span>
            El proceso crea el esquema PostgreSQL, las tablas espaciales (predios, permisos,
            plano regulador, alumbrado) y el workspace GeoServer en segundos.
          </span>
        </div>

        <button
          type="submit"
          disabled={estaEnviando || !form.nombre || !form.codigo || !form.subdominio}
          className="btn-primario w-full"
        >
          {estaEnviando ? (
            <>
              <Spinner tamaño="sm" className="mr-2" />
              Creando municipio…
            </>
          ) : (
            'Crear municipio'
          )}
        </button>
      </form>
    </div>
  )
}

export default OnboardingMunicipio
