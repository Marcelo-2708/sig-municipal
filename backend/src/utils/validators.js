/**
 * validators.js — Esquemas Zod reutilizables para validación de inputs en SIG Municipal.
 *
 * Se usan en las rutas y servicios para validar datos de entrada antes
 * de procesarlos o persistirlos en la base de datos.
 */

import { z } from 'zod';

// ── Primitivos ─────────────────────────────────────────────────────────────

/** Email válido, normalizado a minúsculas */
export const zEmail = z
  .string({ required_error: 'El email es requerido' })
  .email('Formato de email inválido')
  .toLowerCase()
  .trim();

/** Contraseña: mínimo 8 caracteres, al menos una letra y un número */
export const zPassword = z
  .string({ required_error: 'La contraseña es requerida' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[a-zA-Z]/, 'La contraseña debe contener al menos una letra')
  .regex(/[0-9]/, 'La contraseña debe contener al menos un número');

/** UUID v4 estándar */
export const zUUID = z
  .string({ required_error: 'El ID es requerido' })
  .uuid('Formato de ID inválido (se espera UUID)');

// ── Paginación ─────────────────────────────────────────────────────────────

/**
 * Parámetros de paginación para listados.
 * pagina: número de página (base 1)
 * limite: registros por página (máximo 100)
 */
export const zPaginacion = z.object({
  pagina: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1, 'La página debe ser mayor a 0')),
  limite: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100, 'El límite máximo es 100')),
});

// ── Coordenadas geográficas ────────────────────────────────────────────────

/**
 * Par de coordenadas geográficas en sistema WGS84 (EPSG:4326).
 * Rango válido para Chile: lat [-56, -17], lon [-76, -66]
 */
export const zCoordenadas = z.object({
  lat: z
    .number({ required_error: 'La latitud es requerida' })
    .min(-90, 'Latitud mínima: -90')
    .max(90, 'Latitud máxima: 90'),
  lon: z
    .number({ required_error: 'La longitud es requerida' })
    .min(-180, 'Longitud mínima: -180')
    .max(180, 'Longitud máxima: 180'),
});

/** Coordenadas específicas del territorio chileno */
export const zCoordenadasChile = z.object({
  lat: z
    .number({ required_error: 'La latitud es requerida' })
    .min(-56, 'Latitud fuera del territorio chileno')
    .max(-17, 'Latitud fuera del territorio chileno'),
  lon: z
    .number({ required_error: 'La longitud es requerida' })
    .min(-76, 'Longitud fuera del territorio chileno')
    .max(-66, 'Longitud fuera del territorio chileno'),
});

// ── Esquemas compuestos ────────────────────────────────────────────────────

/** Login de usuario */
export const zLogin = z.object({
  email: zEmail,
  password: zPassword,
});

/** Creación de reporte ciudadano */
export const zReporte = z.object({
  tipo: z.enum(
    ['bache', 'iluminacion', 'basura', 'arbol', 'semaforo', 'otro'],
    { required_error: 'El tipo de reporte es requerido' }
  ),
  descripcion: z
    .string({ required_error: 'La descripción es requerida' })
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(1000, 'La descripción no puede superar 1000 caracteres')
    .trim(),
  lat: z.number({ required_error: 'La latitud es requerida' }),
  lon: z.number({ required_error: 'La longitud es requerida' }),
  email: zEmail.optional(),
});

/** Búsqueda de predios */
export const zBusquedaPredio = z.object({
  q: z
    .string({ required_error: 'El término de búsqueda es requerido' })
    .min(3, 'La búsqueda debe tener al menos 3 caracteres')
    .max(100, 'La búsqueda es demasiado larga')
    .trim(),
});

/**
 * Valida un objeto con un esquema Zod y lanza AppError en caso de fallo.
 * @param {z.ZodSchema} esquema
 * @param {unknown} datos
 * @returns {object} Datos validados y transformados
 */
export async function validar(esquema, datos) {
  const { AppError } = await import('./AppError.js');
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    const detalle = resultado.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new AppError(`Error de validación: ${detalle}`, 422, 'VALIDACION_FALLIDA');
  }
  return resultado.data;
}
