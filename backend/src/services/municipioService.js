import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { transaccion, consultar } from '../config/database.js'
import { crearWorkspaceSiNoExiste, crearDatastoreWorkspace } from './geoserverService.js'
import { AppError } from '../utils/AppError.js'
import logger from '../utils/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Leído una vez al arrancar el proceso
const TEMPLATE_SQL = readFileSync(
  join(__dirname, '../sql/template_municipio.sql'),
  'utf8'
)

/**
 * Provisiona un nuevo municipio en la plataforma:
 *   1. Crea el esquema PostgreSQL con tablas espaciales
 *   2. Registra el municipio en public.municipios
 *   3. Crea workspace y datastore en GeoServer
 *
 * @param {{ nombre, codigo, subdominio, region?, provincia?, plan? }} datos
 * @returns {Promise<{ municipio: object, advertencias: string[] }>}
 */
export async function crearMunicipio({ nombre, codigo, subdominio, region, provincia, plan = 'basico' }) {
  const esquemaBd = `mun_${codigo.replace(/-/g, '_')}`

  // Validar formato del esquema (la BD lo restringe con CHECK, pero fallar aquí da mejor mensaje)
  if (!/^mun_[a-z0-9_]+$/.test(esquemaBd)) {
    throw new AppError(
      `El código "${codigo}" genera un nombre de esquema inválido "${esquemaBd}"`,
      422,
      'ESQUEMA_INVALIDO'
    )
  }

  // Verificar duplicados antes de iniciar la transacción
  const [dupCodigo, dupSubdominio, dupEsquema] = await Promise.all([
    consultar('SELECT id FROM public.municipios WHERE codigo = $1', [codigo]),
    consultar('SELECT id FROM public.municipios WHERE subdominio = $1', [subdominio]),
    consultar(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1",
      [esquemaBd]
    ),
  ])

  if (dupCodigo.rows.length > 0)
    throw new AppError(`Ya existe un municipio con el código "${codigo}"`, 409, 'CODIGO_EN_USO')
  if (dupSubdominio.rows.length > 0)
    throw new AppError(`Ya existe un municipio con el subdominio "${subdominio}"`, 409, 'SUBDOMINIO_EN_USO')
  if (dupEsquema.rows.length > 0)
    throw new AppError(`El esquema "${esquemaBd}" ya existe en la base de datos`, 409, 'ESQUEMA_EN_USO')

  const advertencias = []

  // Transacción: esquema + tablas espaciales + registro
  const municipio = await transaccion(async (cliente) => {
    logger.info({ esquemaBd }, 'Creando esquema del municipio')
    await cliente.query(`CREATE SCHEMA ${esquemaBd}`)

    // Permisos para el rol de aplicación (no fatal si sig_app no existe en dev)
    try {
      await cliente.query(`GRANT USAGE ON SCHEMA ${esquemaBd} TO sig_app`)
      await cliente.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${esquemaBd} TO sig_app`
      )
      await cliente.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA ${esquemaBd} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sig_app`
      )
    } catch (err) {
      logger.warn({ err, esquemaBd }, 'No se pudieron otorgar permisos a sig_app')
      advertencias.push('Permisos de sig_app pendientes. Ejecutar GRANT manualmente si es necesario.')
    }

    // Tablas espaciales desde template
    logger.info({ esquemaBd }, 'Creando tablas espaciales')
    const sqlTablas = TEMPLATE_SQL.replaceAll('{municipio}', esquemaBd)
    await cliente.query(sqlTablas)

    // Registro en public.municipios
    const res = await cliente.query(
      `INSERT INTO public.municipios
         (codigo, nombre, subdominio, region, provincia, esquema_bd, activo, plan, config)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
       RETURNING id, codigo, nombre, subdominio, region, provincia, esquema_bd, activo, plan, creado_en`,
      [
        codigo,
        nombre,
        subdominio,
        region   || null,
        provincia || null,
        esquemaBd,
        plan,
        JSON.stringify({
          centro_mapa: { lat: -35.6, lon: -71.5, zoom: 12 },
          descripcion: `Configuración inicial de ${nombre}`,
        }),
      ]
    )

    return res.rows[0]
  })

  logger.info({ municipioId: municipio.id, codigo }, 'Municipio creado en BD')

  // GeoServer fuera de la transacción (sistema externo — fallo no revierte la BD)
  try {
    await crearWorkspaceSiNoExiste(codigo)
    await crearDatastoreWorkspace(codigo, esquemaBd)
    logger.info({ workspace: codigo }, 'Workspace GeoServer configurado')
  } catch (err) {
    logger.error({ err }, 'Error al configurar GeoServer — municipio activo pero workspace pendiente')
    advertencias.push(
      'Workspace GeoServer no pudo crearse automáticamente. ' +
      'Configurar manualmente con el script configurar_demo.ps1 adaptado al nuevo municipio.'
    )
  }

  return { municipio, advertencias }
}

/**
 * Lista todos los municipios con conteo de usuarios y capas activas.
 */
export async function listarMunicipios() {
  const res = await consultar(
    `SELECT
       m.id, m.codigo, m.nombre, m.subdominio, m.region,
       m.esquema_bd, m.activo, m.plan, m.creado_en,
       COUNT(DISTINCT u.id) FILTER (WHERE u.activo)  AS usuarios_activos,
       COUNT(DISTINCT c.id) FILTER (WHERE c.activo)  AS capas_activas
     FROM public.municipios m
     LEFT JOIN public.usuarios u ON u.municipio_id = m.id
     LEFT JOIN public.capas    c ON c.municipio_id = m.id
     GROUP BY m.id
     ORDER BY m.nombre ASC`
  )
  return res.rows
}
