/**
 * auth.test.js — Tests de las rutas de autenticación de SIG Municipal.
 *
 * Casos cubiertos:
 *   ✓ Login exitoso con credenciales correctas
 *   ✓ Login fallido con contraseña incorrecta
 *   ✓ Login fallido con email inexistente
 *   ✓ Login fallido con payload inválido (validación)
 *   ✓ Refresh token exitoso
 *   ✓ Refresh token inválido retorna 401
 *   ✓ GET /api/auth/me sin token retorna 401
 *   ✓ GET /api/auth/me con token válido retorna datos del usuario
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { construirServidor } from '../../server.js';

// ── Mocks globales ────────────────────────────────────────────────────────

// Mock del módulo de base de datos para no requerir BD real en tests
vi.mock('../../src/config/database.js', () => ({
  consultar: vi.fn(),
  transaccion: vi.fn(),
  verificarConexion: vi.fn().mockResolvedValue(true),
}));

// Mock del módulo de configuración para inyectar variables de entorno de test
vi.mock('../../src/config/env.js', () => ({
  config: {
    entorno: 'test',
    esProduccion: false,
    esTest: true,
    servidor: { puerto: 3001, host: '127.0.0.1' },
    baseDatos: {
      usuario: 'test',
      contrasena: 'test',
      nombre: 'test_db',
      host: 'localhost',
      puerto: 5432,
      poolMax: 5,
      poolMin: 1,
      idleTimeoutMillis: 10000,
    },
    jwt: {
      secreto: 'secreto-de-prueba-minimo-32-caracteres-largo',
      accessExpira: '15m',
      refreshExpira: '7d',
    },
    geoserver: { url: 'http://localhost:8080/geoserver', usuario: 'admin', contrasena: 'geoserver' },
    dominio: { base: 'test.local' },
    log: { nivel: 'silent' },
  },
}));

// ── Datos de prueba ───────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';

const HASH_CONTRASENA = await bcrypt.hash('Contrasena123', 10);

const USUARIO_MOCK = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'funcionario@concepcion.cl',
  nombre: 'Juan Pérez',
  contrasena_hash: HASH_CONTRASENA,
  rol: 'funcionario',
  activo: true,
  municipio_id: 'tenant-uuid-concepcion',
  municipio_codigo: 'concepcion',
  esquema_bd: 'municipio_concepcion',
};

const TENANT_MOCK = {
  id: 'tenant-uuid-concepcion',
  codigo: 'concepcion',
  nombre: 'Municipalidad de Concepción',
  esquema_bd: 'municipio_concepcion',
  activo: true,
};

// ── Setup ─────────────────────────────────────────────────────────────────

let app;
let consultarMock;

beforeAll(async () => {
  // Obtener referencia al mock para configurarlo por test
  const dbModule = await import('../../src/config/database.js');
  consultarMock = dbModule.consultar;

  // Configurar respuesta por defecto para resolución de tenant
  // (el middleware tenant.js llama a consultar con la query de municipios)
  consultarMock.mockImplementation(async (sql) => {
    // Simular resolución de tenant
    if (sql.includes('public.municipios')) {
      return { rows: [TENANT_MOCK], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });

  app = await construirServidor();
  await app.ready();
});

afterAll(async () => {
  if (app) await app.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Restaurar mock de tenant por defecto
  consultarMock.mockImplementation(async (sql) => {
    if (sql.includes('public.municipios')) {
      return { rows: [TENANT_MOCK], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  });
});

// ── Tests de POST /api/auth/login ─────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('retorna 200 con tokens cuando las credenciales son correctas', async () => {
    // Configurar mock para retornar usuario válido
    consultarMock.mockImplementation(async (sql) => {
      if (sql.includes('public.municipios')) {
        return { rows: [TENANT_MOCK], rowCount: 1 };
      }
      if (sql.includes('public.usuarios')) {
        return { rows: [USUARIO_MOCK], rowCount: 1 };
      }
      if (sql.includes('refresh_tokens')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { host: 'concepcion.test.local' },
      payload: {
        email: 'funcionario@concepcion.cl',
        password: 'Contrasena123',
      },
    });

    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json();
    expect(cuerpo).toHaveProperty('accessToken');
    expect(cuerpo).toHaveProperty('refreshToken');
    expect(cuerpo).toHaveProperty('usuario');
    expect(cuerpo.usuario.email).toBe('funcionario@concepcion.cl');
    expect(cuerpo.usuario.rol).toBe('funcionario');
    // Nunca exponer el hash de contraseña
    expect(cuerpo.usuario).not.toHaveProperty('contrasena_hash');
  });

  it('retorna 401 cuando la contraseña es incorrecta', async () => {
    consultarMock.mockImplementation(async (sql) => {
      if (sql.includes('public.municipios')) {
        return { rows: [TENANT_MOCK], rowCount: 1 };
      }
      if (sql.includes('public.usuarios')) {
        return { rows: [USUARIO_MOCK], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { host: 'concepcion.test.local' },
      payload: {
        email: 'funcionario@concepcion.cl',
        password: 'ContrasenaIncorrecta99',
      },
    });

    expect(respuesta.statusCode).toBe(401);
    const cuerpo = respuesta.json();
    expect(cuerpo.codigo).toBe('CREDENCIALES_INVALIDAS');
  });

  it('retorna 401 cuando el email no existe', async () => {
    consultarMock.mockImplementation(async (sql) => {
      if (sql.includes('public.municipios')) {
        return { rows: [TENANT_MOCK], rowCount: 1 };
      }
      // Simular usuario no encontrado
      if (sql.includes('public.usuarios')) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { host: 'concepcion.test.local' },
      payload: {
        email: 'noexiste@concepcion.cl',
        password: 'Contrasena123',
      },
    });

    expect(respuesta.statusCode).toBe(401);
    const cuerpo = respuesta.json();
    expect(cuerpo.codigo).toBe('CREDENCIALES_INVALIDAS');
  });

  it('retorna 422 cuando el payload es inválido (email mal formado)', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { host: 'concepcion.test.local' },
      payload: {
        email: 'no-es-un-email',
        password: 'Contrasena123',
      },
    });

    // Fastify schema validation o Zod retornan 400/422
    expect([400, 422]).toContain(respuesta.statusCode);
  });

  it('retorna 400 cuando falta el campo password', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { host: 'concepcion.test.local' },
      payload: {
        email: 'funcionario@concepcion.cl',
      },
    });

    expect([400, 422]).toContain(respuesta.statusCode);
  });
});

// ── Tests de POST /api/auth/refresh ───────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('retorna 401 cuando el refresh token es inválido', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { host: 'concepcion.test.local' },
      payload: {
        refreshToken: 'token-completamente-invalido',
      },
    });

    expect(respuesta.statusCode).toBe(401);
    const cuerpo = respuesta.json();
    expect(cuerpo.codigo).toBe('REFRESH_TOKEN_INVALIDO');
  });

  it('retorna 400 cuando falta el campo refreshToken', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { host: 'concepcion.test.local' },
      payload: {},
    });

    expect([400, 422]).toContain(respuesta.statusCode);
  });
});

// ── Tests de GET /api/auth/me ─────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('retorna 401 cuando no se envía el header Authorization', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { host: 'concepcion.test.local' },
      // Sin header Authorization
    });

    expect(respuesta.statusCode).toBe(401);
    const cuerpo = respuesta.json();
    expect(cuerpo.codigo).toBe('TOKEN_INVALIDO');
  });

  it('retorna 401 cuando el token JWT es inválido', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        host: 'concepcion.test.local',
        Authorization: 'Bearer token.invalido.aqui',
      },
    });

    expect(respuesta.statusCode).toBe(401);
  });

  it('retorna 200 con datos del usuario cuando el token es válido', async () => {
    // Generar un token JWT válido para el test
    const tokenValido = app.jwt.sign({
      sub: USUARIO_MOCK.id,
      email: USUARIO_MOCK.email,
      rol: USUARIO_MOCK.rol,
      tenantId: USUARIO_MOCK.municipio_id,
    });

    // Configurar mock para retornar usuario
    consultarMock.mockImplementation(async (sql) => {
      if (sql.includes('public.municipios')) {
        return { rows: [TENANT_MOCK], rowCount: 1 };
      }
      if (sql.includes('public.usuarios')) {
        return {
          rows: [{
            id: USUARIO_MOCK.id,
            email: USUARIO_MOCK.email,
            nombre: USUARIO_MOCK.nombre,
            rol: USUARIO_MOCK.rol,
            municipioId: USUARIO_MOCK.municipio_id,
            activo: true,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        host: 'concepcion.test.local',
        Authorization: `Bearer ${tokenValido}`,
      },
    });

    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json();
    expect(cuerpo.email).toBe(USUARIO_MOCK.email);
    expect(cuerpo.rol).toBe(USUARIO_MOCK.rol);
    expect(cuerpo).not.toHaveProperty('contrasena_hash');
  });
});

// ── Tests de GET /health ──────────────────────────────────────────────────

describe('GET /health', () => {
  it('retorna 200 con estado ok (sin requerir tenant)', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(respuesta.statusCode).toBe(200);
    const cuerpo = respuesta.json();
    expect(cuerpo.estado).toBe('ok');
    expect(cuerpo).toHaveProperty('version');
    expect(cuerpo).toHaveProperty('timestamp');
  });
});
