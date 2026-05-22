import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api.js'
import useAuth from '../hooks/useAuth.js'
import useTenant from '../hooks/useTenant.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatearRelativo(iso) {
  if (!iso) return 'Sin registros'
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  const h    = Math.floor(diff / 3600000)
  const d    = Math.floor(diff / 86400000)
  if (min < 1)  return 'Hace un momento'
  if (min < 60) return `Hace ${min} min`
  if (h   < 24) return `Hace ${h} h`
  return `Hace ${d} día${d !== 1 ? 's' : ''}`
}

function formatearFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Componentes de métricas ───────────────────────────────────────────────────

function Esqueleto() {
  return <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
}

function TarjetaMetrica({ valor, etiqueta, subtitulo, color, icono, cargando }) {
  const colores = {
    blue:   { fondo: 'bg-blue-50',   icono: 'text-blue-600',   num: 'text-blue-700'   },
    purple: { fondo: 'bg-violet-50', icono: 'text-violet-600', num: 'text-violet-700' },
    amber:  { fondo: 'bg-amber-50',  icono: 'text-amber-600',  num: 'text-amber-700'  },
    green:  { fondo: 'bg-emerald-50',icono: 'text-emerald-600',num: 'text-emerald-700'},
  }
  const c = colores[color] ?? colores.blue

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${c.fondo}`}>
        <span className={c.icono}>{icono}</span>
      </div>
      <div className="min-w-0">
        {cargando
          ? <Esqueleto />
          : <p className={`text-2xl font-bold leading-none ${c.num}`}>{valor ?? '—'}</p>
        }
        <p className="text-sm font-medium text-gray-700 mt-1">{etiqueta}</p>
        {subtitulo && (
          <p className="text-xs text-gray-400 mt-0.5">{subtitulo}</p>
        )}
      </div>
    </div>
  )
}

// ── Estado del stack ──────────────────────────────────────────────────────────

function PuntoEstado({ ok, cargando }) {
  if (cargando) return <span className="w-2.5 h-2.5 rounded-full bg-gray-300 animate-pulse inline-block" />
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full inline-block ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}
      aria-label={ok ? 'Conectado' : 'Sin conexión'}
    />
  )
}

function PanelEstado({ health, cargando }) {
  const bdOk = health?.baseDatos === 'conectada'
  const gsOk = health?.geoserver === 'conectado'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 h-full">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Estado del sistema
      </h2>
      <ul className="space-y-3">
        {[
          { etiqueta: 'Base de datos PostgreSQL', ok: bdOk },
          { etiqueta: 'GeoServer',                ok: gsOk },
        ].map(({ etiqueta, ok }) => (
          <li key={etiqueta} className="flex items-center gap-3">
            <PuntoEstado ok={ok} cargando={cargando} />
            <span className="text-sm text-gray-700">{etiqueta}</span>
            {!cargando && (
              <span className={`ml-auto text-xs font-medium ${ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {ok ? 'Conectado' : 'Sin conexión'}
              </span>
            )}
          </li>
        ))}
      </ul>
      {health?.version && (
        <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
          API v{health.version} · {formatearFecha(health.timestamp)}
        </p>
      )}
    </div>
  )
}

// ── Accesos rápidos ───────────────────────────────────────────────────────────

const ACCESOS = [
  {
    ruta: '/admin/capas',
    titulo: 'Gestión de Capas',
    desc: 'Publicar, ordenar y activar capas GIS',
    rolMin: 'funcionario',
    icono: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    ruta: '/admin/usuarios',
    titulo: 'Gestión de Usuarios',
    desc: 'Crear y administrar cuentas del municipio',
    rolMin: 'admin_municipal',
    icono: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    ruta: '/admin/log',
    titulo: 'Log de Cambios',
    desc: 'Auditoría de operaciones del sistema',
    rolMin: 'admin_municipal',
    icono: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    ruta: '/',
    titulo: 'Ver Mapa Público',
    desc: 'Visualiza como lo ven los ciudadanos',
    rolMin: null,
    icono: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    ruta: '/admin/municipios/nuevo',
    titulo: 'Nuevo Municipio',
    desc: 'Incorporar una nueva municipalidad',
    rolMin: 'super_admin',
    icono: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
]

function AccesosRapidos({ tienePermiso }) {
  const visibles = ACCESOS.filter((a) => !a.rolMin || tienePermiso(a.rolMin))

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 h-full">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        Accesos rápidos
      </h2>
      <div className="space-y-2">
        {visibles.map((a) => (
          <Link
            key={a.ruta}
            to={a.ruta}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50
                       transition-colors group"
          >
            <span className="text-municipal-600 group-hover:text-municipal-800 flex-shrink-0">
              {a.icono}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 group-hover:text-municipal-700">
                {a.titulo}
              </p>
              <p className="text-xs text-gray-400 truncate">{a.desc}</p>
            </div>
            <svg className="w-4 h-4 text-gray-300 group-hover:text-municipal-500 ml-auto flex-shrink-0"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Info del municipio ────────────────────────────────────────────────────────

const PLANES = { basico: 'Básico', estandar: 'Estándar', premium: 'Premium' }
const COLORES_PLAN = {
  basico:   'bg-gray-100 text-gray-700',
  estandar: 'bg-blue-100 text-blue-700',
  premium:  'bg-purple-100 text-purple-700',
}

function InfoMunicipio({ municipio }) {
  if (!municipio) return null

  const filas = [
    ['Región',     municipio.region],
    ['Provincia',  municipio.provincia],
    ['Subdominio', municipio.subdominio ? `${municipio.subdominio}.sig.municipalidad.cl` : null],
    ['Esquema BD', municipio.esquema_bd],
  ].filter(([, v]) => v)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Municipio
        </h2>
        {municipio.plan && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COLORES_PLAN[municipio.plan] ?? COLORES_PLAN.basico}`}>
            {PLANES[municipio.plan] ?? municipio.plan}
          </span>
        )}
      </div>
      <p className="text-base font-semibold text-gray-900 mb-3">{municipio.nombre}</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {filas.map(([label, valor]) => (
          <>
            <dt key={`dt-${label}`} className="text-gray-400">{label}</dt>
            <dd key={`dd-${label}`} className="text-gray-800 font-mono text-xs break-all">{valor}</dd>
          </>
        ))}
      </dl>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

function Dashboard() {
  const { usuario, tienePermiso } = useAuth()
  const { municipio } = useTenant()

  const { data: stats, isLoading: cargandoStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn:  () => api.get('/api/admin/stats'),
    staleTime: 30_000,
  })

  const { data: health, isLoading: cargandoHealth } = useQuery({
    queryKey: ['health'],
    queryFn:  () => api.get('/health'),
    staleTime: 30_000,
    retry: false,
  })

  const ahora = new Date().toLocaleDateString('es-CL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="max-w-5xl space-y-6">

      {/* ── Bienvenida ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {usuario?.nombre ?? 'Usuario'}
        </h1>
        <p className="text-gray-500 mt-1 capitalize">
          {municipio?.nombre ?? 'Municipalidad'} · {ahora}
        </p>
      </div>

      {/* ── Métricas ────────────────────────────────────────────────────── */}
      <section aria-label="Métricas del municipio">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <TarjetaMetrica
            cargando={cargandoStats}
            valor={stats?.capas_activas ?? 0}
            etiqueta="Capas activas"
            subtitulo={stats ? `de ${stats.total_capas} totales` : null}
            color="blue"
            icono={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            }
          />
          <TarjetaMetrica
            cargando={cargandoStats}
            valor={stats?.usuarios_activos ?? 0}
            etiqueta="Usuarios activos"
            subtitulo={stats ? `de ${stats.total_usuarios} totales` : null}
            color="purple"
            icono={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
          <TarjetaMetrica
            cargando={cargandoStats}
            valor={stats?.reportes_pendientes ?? 0}
            etiqueta="Reportes pendientes"
            color="amber"
            icono={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
          <TarjetaMetrica
            cargando={cargandoStats}
            valor={formatearRelativo(stats?.ultima_actividad)}
            etiqueta="Última actividad"
            subtitulo={stats?.ultima_capa_actualizada
              ? `Capa: ${formatearRelativo(stats.ultima_capa_actualizada)}`
              : null
            }
            color="green"
            icono={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      </section>

      {/* ── Estado + Accesos ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PanelEstado health={health} cargando={cargandoHealth} />
        <AccesosRapidos tienePermiso={tienePermiso} />
      </section>

      {/* ── Info del municipio ───────────────────────────────────────────── */}
      <InfoMunicipio municipio={municipio} />

    </div>
  )
}

export default Dashboard
