/**
 * usuarios.js — Rutas de gestión de usuarios para SIG Municipal.
 *
 * Panel de administración (admin_municipal+):
 *   GET    /api/admin/usuarios              — Lista usuarios del municipio
 *   POST   /api/admin/usuarios              — Crear usuario
 *   GET    /api/admin/usuarios/:id          — Ver un usuario
 *   PUT    /api/admin/usuarios/:id          — Editar nombre/rol
 *   PATCH  /api/admin/usuarios/:id/estado  — Activar / desactivar
 *   POST   /api/admin/usuarios/:id/reset-password — Resetear contraseña
 *
 * Perfil propio (funcionario+):
 *   GET    /api/perfil                      — Ver perfil propio
 *   PUT    /api/perfil                      — Editar nombre propio
 */

import { verificarToken, soloRoles } from '../middleware/auth.js';
import { registrarLog } from '../services/logService.js';
import {
  obtenerUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  toggleActivoUsuario,
  resetearContrasena,
  obtenerPerfil,
  actualizarPerfil,
  ROLES_ASIGNABLES,
} from '../services/usuarioService.js';
import { zEmail, zPassword, zPaginacion, validar } from '../utils/validators.js';
import { z } from 'zod';

const zCrearUsuario = z.object({
  nombre:    z.string().min(2).max(200).trim(),
  email:     zEmail,
  rol:       z.enum(ROLES_ASIGNABLES),
  contrasena: zPassword.optional(),
});

const zActualizarUsuario = z.object({
  nombre: z.string().min(2).max(200).trim().optional(),
  rol:    z.enum(ROLES_ASIGNABLES).optional(),
}).refine((d) => d.nombre || d.rol, { message: 'Se debe enviar al menos nombre o rol' });

const zEstado = z.object({ activo: z.boolean() });

const zPerfil = z.object({
  nombre: z.string().min(2).max(200).trim(),
});

const zFiltrosUsuarios = z.object({
  pagina:  z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limite:  z.string().optional().transform((v) => (v ? parseInt(v, 10) : 20)),
  rol:     z.enum([...ROLES_ASIGNABLES, 'super_admin']).optional(),
  activo:  z.string().optional().transform((v) => (v === 'false' ? false : v === 'true' ? true : undefined)),
});

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function rutasUsuarios(fastify) {
  // ── GET /api/admin/usuarios ───────────────────────────────────────────
  fastify.get(
    '/api/admin/usuarios',
    {
      preHandler: [verificarToken, soloRoles('admin_municipal')],
      schema: {
        description: 'Lista los usuarios del municipio con filtros opcionales',
        tags: ['Usuarios Admin'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            pagina: { type: 'string' },
            limite: { type: 'string' },
            rol:    { type: 'string' },
            activo: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const filtros = await validar(zFiltrosUsuarios, request.query);
      const resultado = await obtenerUsuarios(request.tenant.id, filtros);
      return reply.status(200).send(resultado);
    }
  );

  // ── POST /api/admin/usuarios ──────────────────────────────────────────
  fastify.post(
    '/api/admin/usuarios',
    {
      preHandler: [verificarToken, soloRoles('admin_municipal')],
      schema: {
        description: 'Crea un nuevo usuario en el municipio',
        tags: ['Usuarios Admin'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['nombre', 'email', 'rol'],
          properties: {
            nombre:    { type: 'string' },
            email:     { type: 'string', format: 'email' },
            rol:       { type: 'string', enum: ROLES_ASIGNABLES },
            contrasena: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const datos = await validar(zCrearUsuario, request.body);
      const usuario = await crearUsuario(datos, request.tenant.id);
      await registrarLog({
        usuarioId: request.usuario.sub, municipioId: request.tenant.id,
        tablaAfectada: 'usuarios', operacion: 'INSERT', registroId: usuario.id,
        datosNuevos: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
        ipOrigen: request.ip,
        descripcion: `Usuario creado: ${usuario.email} (${usuario.rol})`,
      });
      return reply.status(201).send(usuario);
    }
  );

  // ── GET /api/admin/usuarios/:id ───────────────────────────────────────
  fastify.get(
    '/api/admin/usuarios/:id',
    {
      preHandler: [verificarToken, soloRoles('admin_municipal')],
      schema: {
        description: 'Obtiene un usuario del municipio por ID',
        tags: ['Usuarios Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const usuario = await obtenerUsuario(request.params.id, request.tenant.id);
      return reply.status(200).send(usuario);
    }
  );

  // ── PUT /api/admin/usuarios/:id ───────────────────────────────────────
  fastify.put(
    '/api/admin/usuarios/:id',
    {
      preHandler: [verificarToken, soloRoles('admin_municipal')],
      schema: {
        description: 'Actualiza nombre y/o rol de un usuario',
        tags: ['Usuarios Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          properties: {
            nombre: { type: 'string' },
            rol:    { type: 'string', enum: ROLES_ASIGNABLES },
          },
        },
      },
    },
    async (request, reply) => {
      const cambios = await validar(zActualizarUsuario, request.body);
      const usuario = await actualizarUsuario(request.params.id, request.tenant.id, cambios);
      await registrarLog({
        usuarioId: request.usuario.sub, municipioId: request.tenant.id,
        tablaAfectada: 'usuarios', operacion: 'UPDATE', registroId: request.params.id,
        datosNuevos: cambios,
        ipOrigen: request.ip,
        descripcion: `Usuario editado: ${usuario.email}`,
      });
      return reply.status(200).send(usuario);
    }
  );

  // ── PATCH /api/admin/usuarios/:id/estado ─────────────────────────────
  fastify.patch(
    '/api/admin/usuarios/:id/estado',
    {
      preHandler: [verificarToken, soloRoles('admin_municipal')],
      schema: {
        description: 'Activa o desactiva un usuario (soft delete)',
        tags: ['Usuarios Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['activo'],
          properties: { activo: { type: 'boolean' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Un usuario no puede desactivarse a sí mismo
      if (id === request.usuario.sub && !request.body.activo) {
        return reply.status(400).send({
          error: 'No puedes desactivar tu propia cuenta',
          codigo: 'AUTODESACTIVACION_NO_PERMITIDA',
          statusCode: 400,
        });
      }

      const { activo } = await validar(zEstado, request.body);
      const usuario = await toggleActivoUsuario(id, request.tenant.id, activo);
      await registrarLog({
        usuarioId: request.usuario.sub, municipioId: request.tenant.id,
        tablaAfectada: 'usuarios', operacion: 'UPDATE', registroId: id,
        datosAnteriores: { activo: !activo },
        datosNuevos:     { activo },
        ipOrigen: request.ip,
        descripcion: `Usuario ${activo ? 'activado' : 'desactivado'}: ${usuario.email}`,
      });
      return reply.status(200).send(usuario);
    }
  );

  // ── POST /api/admin/usuarios/:id/reset-password ───────────────────────
  fastify.post(
    '/api/admin/usuarios/:id/reset-password',
    {
      preHandler: [verificarToken, soloRoles('admin_municipal')],
      schema: {
        description: 'Genera una contraseña temporal para el usuario',
        tags: ['Usuarios Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const resultado = await resetearContrasena(request.params.id, request.tenant.id);
      await registrarLog({
        usuarioId: request.usuario.sub, municipioId: request.tenant.id,
        tablaAfectada: 'usuarios', operacion: 'UPDATE', registroId: request.params.id,
        datosNuevos: { contrasena_reseteada: true },
        ipOrigen: request.ip,
        descripcion: 'Contraseña reseteada por administrador',
      });
      return reply.status(200).send(resultado);
    }
  );

  // ── GET /api/perfil ───────────────────────────────────────────────────
  fastify.get(
    '/api/perfil',
    {
      preHandler: [verificarToken, soloRoles('funcionario')],
      schema: {
        description: 'Retorna el perfil del usuario autenticado',
        tags: ['Perfil'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const perfil = await obtenerPerfil(request.usuario.sub);
      return reply.status(200).send(perfil);
    }
  );

  // ── PUT /api/perfil ───────────────────────────────────────────────────
  fastify.put(
    '/api/perfil',
    {
      preHandler: [verificarToken, soloRoles('funcionario')],
      schema: {
        description: 'Actualiza el nombre del usuario autenticado',
        tags: ['Perfil'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['nombre'],
          properties: { nombre: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const datos = await validar(zPerfil, request.body);
      const perfil = await actualizarPerfil(request.usuario.sub, datos);
      return reply.status(200).send(perfil);
    }
  );
}
