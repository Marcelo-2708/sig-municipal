/**
 * AppError.js — Clase de error personalizada para SIG Municipal.
 *
 * Permite distinguir errores de negocio (operacionales) de errores inesperados
 * del sistema. El handler global lee estas propiedades para formatear la respuesta HTTP.
 *
 * Uso:
 *   throw new AppError('El usuario no existe', 404, 'USUARIO_NO_ENCONTRADO');
 */

export class AppError extends Error {
  /**
   * @param {string} mensaje       - Mensaje legible para logs y respuesta al cliente
   * @param {number} codigoHttp    - Código HTTP (400, 401, 403, 404, 409, 422, 500…)
   * @param {string} codigo        - Código string identificador (ej: 'CAPA_NO_ENCONTRADA')
   * @param {boolean} operacional  - true = error esperado de negocio; false = error del sistema
   */
  constructor(mensaje, codigoHttp = 500, codigo = 'ERROR_INTERNO', operacional = true) {
    super(mensaje);

    this.name = 'AppError';
    this.codigoHttp = codigoHttp;
    this.codigo = codigo;
    this.operacional = operacional;

    // Captura stack trace limpio (sin incluir el constructor de AppError)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// ── Errores predefinidos reutilizables ─────────────────────────────────────

export const errores = {
  // Autenticación / Autorización
  NO_AUTENTICADO: new AppError('Token de acceso requerido', 401, 'NO_AUTENTICADO'),
  TOKEN_INVALIDO: new AppError('Token inválido o expirado', 401, 'TOKEN_INVALIDO'),
  SIN_PERMISO: new AppError('No tienes permiso para realizar esta acción', 403, 'SIN_PERMISO'),

  // Tenant
  TENANT_NO_ENCONTRADO: new AppError('Municipio no encontrado', 404, 'TENANT_NO_ENCONTRADO'),
  TENANT_INACTIVO: new AppError('Municipio inactivo', 403, 'TENANT_INACTIVO'),

  // Usuarios
  USUARIO_NO_ENCONTRADO: new AppError('Usuario no encontrado', 404, 'USUARIO_NO_ENCONTRADO'),
  CREDENCIALES_INVALIDAS: new AppError('Email o contraseña incorrectos', 401, 'CREDENCIALES_INVALIDAS'),
  EMAIL_EN_USO: new AppError('El email ya está en uso', 409, 'EMAIL_EN_USO'),

  // Capas
  CAPA_NO_ENCONTRADA: new AppError('Capa no encontrada', 404, 'CAPA_NO_ENCONTRADA'),

  // Predios
  PREDIO_NO_ENCONTRADO: new AppError('Predio no encontrado', 404, 'PREDIO_NO_ENCONTRADO'),
  BUSQUEDA_MUY_CORTA: new AppError('La búsqueda debe tener al menos 3 caracteres', 400, 'BUSQUEDA_MUY_CORTA'),

  // Reportes
  REPORTE_NO_ENCONTRADO: new AppError('Reporte no encontrado', 404, 'REPORTE_NO_ENCONTRADO'),

  // Generales
  VALIDACION: (detalle) => new AppError(`Error de validación: ${detalle}`, 422, 'VALIDACION_FALLIDA'),
  INTERNO: new AppError('Error interno del servidor', 500, 'ERROR_INTERNO', false),
};
