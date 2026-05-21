/**
 * Componente de indicador de carga.
 * Muestra una animación circular CSS sin dependencias externas.
 */

function Spinner({ tamaño = 'md', className = '' }) {
  const tamaños = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-[3px]',
    xl: 'w-16 h-16 border-4',
  }

  const clasesTamaño = tamaños[tamaño] ?? tamaños.md

  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`
        inline-block rounded-full
        border-gray-200 border-t-municipal-600
        animate-spin
        ${clasesTamaño}
        ${className}
      `}
    />
  )
}

export default Spinner
