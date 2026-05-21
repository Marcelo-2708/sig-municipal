import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Store de autenticación.
 * Persiste el token y los datos del usuario en localStorage para
 * mantener la sesión entre recargas de página.
 */
const useAuthStore = create(
  persist(
    (set, get) => ({
      // Estado inicial
      usuario: null,
      token: null,
      tokenRefresco: null,

      /**
       * Inicia sesión guardando usuario y tokens.
       * @param {object} datosUsuario - Objeto con datos del usuario autenticado
       * @param {string} accessToken  - JWT de acceso
       * @param {string} refreshToken - JWT de refresco
       */
      iniciarSesion: (datosUsuario, accessToken, refreshToken) => {
        set({
          usuario: datosUsuario,
          token: accessToken,
          tokenRefresco: refreshToken,
        })
      },

      /**
       * Actualiza solo el token de acceso (tras un refresh exitoso).
       * @param {string} nuevoToken - Nuevo JWT de acceso
       */
      actualizarToken: (nuevoToken) => {
        set({ token: nuevoToken })
      },

      /**
       * Cierra sesión limpiando todo el estado de autenticación.
       */
      cerrarSesion: () => {
        set({ usuario: null, token: null, tokenRefresco: null })
      },

      /**
       * Indica si hay un usuario autenticado con token válido.
       * @returns {boolean}
       */
      estaAutenticado: () => {
        const { token, usuario } = get()
        return Boolean(token && usuario)
      },
    }),
    {
      name: 'auth-sig-municipal', // Clave en localStorage
      storage: createJSONStorage(() => localStorage),
      // Solo persiste los campos necesarios, no las funciones
      partialize: (estado) => ({
        usuario: estado.usuario,
        token: estado.token,
        tokenRefresco: estado.tokenRefresco,
      }),
    }
  )
)

export default useAuthStore
