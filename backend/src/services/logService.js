import { consultar } from '../config/database.js'
import logger from '../utils/logger.js'

/**
 * Inserta una entrada en public.log_cambios.
 * Siempre no-fatal: si falla, solo escribe en el logger del proceso.
 */
export async function registrarLog({
  usuarioId    = null,
  municipioId  = null,
  tablaAfectada,
  operacion,
  registroId   = null,
  datosAnteriores = null,
  datosNuevos     = null,
  ipOrigen     = null,
  descripcion  = null,
}) {
  try {
    await consultar(
      `INSERT INTO public.log_cambios
         (usuario_id, municipio_id, tabla_afectada, operacion, registro_id,
          datos_anteriores, datos_nuevos, ip_origen, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9)`,
      [
        usuarioId  || null,
        municipioId || null,
        tablaAfectada,
        operacion,
        registroId  ? String(registroId) : null,
        datosAnteriores ? JSON.stringify(datosAnteriores) : null,
        datosNuevos     ? JSON.stringify(datosNuevos)     : null,
        ipOrigen   || null,
        descripcion || null,
      ]
    )
  } catch (err) {
    logger.error(
      { err, tablaAfectada, operacion },
      'Error al escribir en log_cambios — operación principal no afectada'
    )
  }
}

/**
 * Consulta paginada del log con filtros opcionales.
 *
 * @param {string}  municipioId  - UUID del tenant (obligatorio)
 * @param {object}  filtros
 * @param {string}  [filtros.tabla]       - Filtrar por tabla_afectada
 * @param {string}  [filtros.operacion]   - Filtrar por operacion
 * @param {string}  [filtros.usuarioId]   - Filtrar por usuario_id
 * @param {string}  [filtros.registroId]  - Filtrar por registro_id
 * @param {string}  [filtros.fechaDesde]  - ISO date — desde
 * @param {string}  [filtros.fechaHasta]  - ISO date — hasta
 * @param {number}  [filtros.pagina=1]
 * @param {number}  [filtros.limite=50]
 */
export async function obtenerLog(municipioId, {
  tabla, operacion, usuarioId, registroId,
  fechaDesde, fechaHasta,
  pagina = 1, limite = 50,
} = {}) {
  const conds  = ['l.municipio_id = $1']
  const params = [municipioId]
  let n = 2

  if (tabla)      { conds.push(`l.tabla_afectada = $${n++}`); params.push(tabla) }
  if (operacion)  { conds.push(`l.operacion = $${n++}`);      params.push(operacion) }
  if (usuarioId)  { conds.push(`l.usuario_id = $${n++}`);     params.push(usuarioId) }
  if (registroId) { conds.push(`l.registro_id = $${n++}`);    params.push(registroId) }
  if (fechaDesde) { conds.push(`l.creado_en >= $${n++}`);     params.push(fechaDesde) }
  if (fechaHasta) { conds.push(`l.creado_en <= $${n++}`);     params.push(`${fechaHasta}T23:59:59Z`) }

  const where  = conds.join(' AND ')
  const offset = (pagina - 1) * limite

  const [resTotal, resEntradas] = await Promise.all([
    consultar(`SELECT COUNT(*)::int AS total FROM public.log_cambios l WHERE ${where}`, params),
    consultar(
      `SELECT l.id, l.tabla_afectada, l.operacion, l.registro_id,
              l.datos_anteriores, l.datos_nuevos,
              l.descripcion, l.ip_origen::text AS ip_origen, l.creado_en,
              u.id    AS usuario_id,
              u.email AS usuario_email,
              u.nombre AS usuario_nombre
       FROM public.log_cambios l
       LEFT JOIN public.usuarios u ON u.id = l.usuario_id
       WHERE ${where}
       ORDER BY l.creado_en DESC
       LIMIT $${n} OFFSET $${n + 1}`,
      [...params, limite, offset]
    ),
  ])

  return {
    entradas: resEntradas.rows,
    total:    resTotal.rows[0].total,
    pagina,
    limite,
    paginas:  Math.ceil(resTotal.rows[0].total / limite),
  }
}

/**
 * Genera el contenido CSV del log (hasta 10 000 entradas).
 */
export async function exportarLogCsv(municipioId, filtros) {
  const { entradas } = await obtenerLog(municipioId, { ...filtros, limite: 10000, pagina: 1 })

  const cabecera = [
    'ID', 'Fecha', 'Usuario Email', 'Usuario Nombre',
    'Tabla', 'Operacion', 'Registro ID', 'Descripcion',
  ]

  const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const filas = entradas.map((e) => [
    e.id,
    e.creado_en,
    e.usuario_email  ?? '',
    e.usuario_nombre ?? '',
    e.tabla_afectada,
    e.operacion,
    e.registro_id ?? '',
    e.descripcion ?? '',
  ].map(escapar).join(','))

  return [cabecera.join(','), ...filas].join('\r\n')
}
