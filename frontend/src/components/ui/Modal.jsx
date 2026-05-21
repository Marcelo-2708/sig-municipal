/**
 * Componente Modal genérico.
 * Cierra al presionar Escape o al hacer click fuera del contenido.
 */

import { useEffect, useRef } from 'react'

function Modal({ abierto, onCerrar, titulo, children, className = '' }) {
  const contenidoRef = useRef(null)

  // Cierra con la tecla Escape
  useEffect(() => {
    if (!abierto) return

    function manejarTecla(evento) {
      if (evento.key === 'Escape') {
        onCerrar()
      }
    }

    document.addEventListener('keydown', manejarTecla)
    return () => document.removeEventListener('keydown', manejarTecla)
  }, [abierto, onCerrar])

  // Bloquea el scroll del body mientras el modal está abierto
  useEffect(() => {
    if (abierto) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [abierto])

  if (!abierto) return null

  // Cierra al hacer click en el overlay (fuera del contenido)
  function manejarClickOverlay(evento) {
    if (contenidoRef.current && !contenidoRef.current.contains(evento.target)) {
      onCerrar()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={manejarClickOverlay}
    >
      <div
        ref={contenidoRef}
        className={`
          relative w-full max-w-md bg-white rounded-xl shadow-2xl
          max-h-[90vh] overflow-y-auto
          ${className}
        `}
      >
        {/* Cabecera del modal */}
        {titulo && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
            <button
              onClick={onCerrar}
              aria-label="Cerrar modal"
              className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              {/* Ícono X */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Contenido */}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

export default Modal
