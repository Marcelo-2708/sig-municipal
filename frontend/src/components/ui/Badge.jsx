/**
 * Componente de etiqueta (badge) para categorías de capas.
 * El color se determina automáticamente por la categoría.
 */

// Mapa de categorías a clases de color Tailwind
const COLORES_CATEGORIA = {
  infraestructura: 'bg-blue-100 text-blue-800',
  urbanismo:       'bg-purple-100 text-purple-800',
  ambiente:        'bg-green-100 text-green-800',
  transporte:      'bg-yellow-100 text-yellow-800',
  servicios:       'bg-orange-100 text-orange-800',
  catastro:        'bg-red-100 text-red-800',
  riesgos:         'bg-rose-100 text-rose-800',
  patrimonio:      'bg-amber-100 text-amber-800',
  salud:           'bg-teal-100 text-teal-800',
  educacion:       'bg-indigo-100 text-indigo-800',
  default:         'bg-gray-100 text-gray-700',
}

/**
 * @param {object} props
 * @param {string} props.categoria  - Categoría de la capa (determina el color)
 * @param {string} [props.texto]    - Texto a mostrar (usa la categoría si no se especifica)
 * @param {string} [props.className]
 */
function Badge({ categoria, texto, className = '' }) {
  const claveColor = categoria?.toLowerCase() ?? 'default'
  const claseColor = COLORES_CATEGORIA[claveColor] ?? COLORES_CATEGORIA.default
  const etiqueta   = texto ?? categoria ?? 'Sin categoría'

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
        ${claseColor}
        ${className}
      `}
    >
      {etiqueta}
    </span>
  )
}

export default Badge
