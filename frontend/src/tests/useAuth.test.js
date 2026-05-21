/**
 * Pruebas unitarias del hook useAuth.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useAuth from '../hooks/useAuth.js'
import useAuthStore from '../store/authStore.js'

// Limpia el store entre pruebas
beforeEach(() => {
  useAuthStore.setState({
    usuario: null,
    token: null,
    tokenRefresco: null,
  })
})

describe('useAuth', () => {
  it('retorna estaAutenticado = false cuando no hay sesión', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.estaAutenticado).toBe(false)
    expect(result.current.usuario).toBeNull()
    expect(result.current.rol).toBeNull()
  })

  it('retorna estaAutenticado = true tras iniciar sesión', () => {
    const { result } = renderHook(() => useAuth())

    act(() => {
      result.current.iniciarSesion(
        { nombre: 'Ana González', rol: 'funcionario' },
        'token-acceso-123',
        'token-refresco-456'
      )
    })

    expect(result.current.estaAutenticado).toBe(true)
    expect(result.current.usuario.nombre).toBe('Ana González')
    expect(result.current.rol).toBe('funcionario')
  })

  it('tienePermiso retorna false para un usuario sin sesión', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.tienePermiso('funcionario')).toBe(false)
  })

  it('tienePermiso retorna true cuando el rol es suficiente', () => {
    const { result } = renderHook(() => useAuth())

    act(() => {
      result.current.iniciarSesion(
        { nombre: 'Carlos', rol: 'admin' },
        'tok',
        'ref'
      )
    })

    expect(result.current.tienePermiso('funcionario')).toBe(true)
    expect(result.current.tienePermiso('admin')).toBe(true)
    expect(result.current.tienePermiso('superadmin')).toBe(false)
  })

  it('cerrarSesion limpia todos los datos', () => {
    const { result } = renderHook(() => useAuth())

    act(() => {
      result.current.iniciarSesion({ nombre: 'Test', rol: 'ciudadano' }, 'tok', 'ref')
    })

    act(() => {
      result.current.cerrarSesion()
    })

    expect(result.current.estaAutenticado).toBe(false)
    expect(result.current.usuario).toBeNull()
    expect(result.current.token).toBeNull()
  })
})
