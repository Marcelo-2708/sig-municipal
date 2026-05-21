/**
 * Buscador predial con debounce y autocompletado.
 * Llama a GET /api/predios/buscar?q=texto tras 400ms de inactividad.
 * Al seleccionar un resultado, vuela al predio y lo resalta en el mapa.
 */

import { useState, useRef, useEffect, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api.js'
import useMapa from '../../hooks/useMapa.js'
import useMapaStore from '../../store/mapaStore.js'
import Spinner from '../ui/Spinner.jsx'

// Mínimo de caracteres antes de buscar
const MIN_CHARS = 3

function BuscadorPredial() {
  const [consulta, setConsulta] = useState('')
  const [consultaDebounced, setConsultaDebounced] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [indiceFocused, setIndiceFocused] = useState(-1)

  const inputRef = useRef(null)
  const listaRef = useRef(null)
  const temporizadorRef = useRef(null)

  const { volarA, resaltarPredio } = useMapa()
  const setPredioResaltado = useMapaStore((s) => s.setPredioResaltado)

  const idCombobox = useId()
  const idLista    = useId()

  // Debounce de 400ms antes de disparar la búsqueda
  useEffect(() => {
    clearTimeout(temporizadorRef.current)
    if (consulta.length >= MIN_CHARS) {
      temporizadorRef.current = setTimeout(() => {
        setConsultaDebounced(consulta)
      }, 400)
    } else {
      setConsultaDebounced('')
      setAbierto(false)
    }
    return () => clearTimeout(temporizadorRef.current)
  }, [consulta])

  // Búsqueda de predios
  const {
    data: resultados = [],
    isFetching: buscando,
  } = useQuery({
    queryKey: ['buscar-predios', consultaDebounced],
    queryFn: () => api.get(`/api/predios/buscar?q=${encodeURIComponent(consultaDebounced)}`),
    enabled: consultaDebounced.length >= MIN_CHARS,
    staleTime: 30_000,
  })

  // Abre el dropdown cuando hay resultados
  useEffect(() => {
    if (resultados.length > 0 && consultaDebounced.length >= MIN_CHARS) {
      setAbierto(true)
      setIndiceFocused(-1)
    }
  }, [resultados, consultaDebounced])

  // Carga el detalle del predio al seleccionar un resultado
  async function seleccionarPredio(predio) {
    setConsulta(predio.direccion ?? predio.rol ?? '')
    setAbierto(false)
    setIndiceFocused(-1)

    try {
      const detalle = await api.get(`/api/predios/${encodeURIComponent(predio.rol)}`)
      if (detalle.geometria) {
        resaltarPredio(detalle.geometria)
      } else if (predio.longitud && predio.latitud) {
        volarA(predio.longitud, predio.latitud)
      }
      // Guarda el predio seleccionado en el store para la ficha
      setPredioResaltado(detalle)
    } catch {
      // Si falla la carga del detalle, al menos vuela a la posición
      if (predio.longitud && predio.latitud) {
        volarA(predio.longitud, predio.latitud)
      }
    }
  }

  // Navegación con teclado en el dropdown
  function manejarTecla(e) {
    if (!abierto) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setIndiceFocused((prev) => Math.min(prev + 1, resultados.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setIndiceFocused((prev) => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (indiceFocused >= 0 && resultados[indiceFocused]) {
          seleccionarPredio(resultados[indiceFocused])
        }
        break
      case 'Escape':
        setAbierto(false)
        setIndiceFocused(-1)
        inputRef.current?.focus()
        break
    }
  }

  function limpiarBusqueda() {
    setConsulta('')
    setConsultaDebounced('')
    setAbierto(false)
    inputRef.current?.focus()
  }

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-panel">
      <div className="relative">
        {/* Campo de búsqueda */}
        <div className="relative flex items-center">
          {/* Ícono lupa */}
          <svg
            className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          <input
            ref={inputRef}
            id={idCombobox}
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={idLista}
            aria-expanded={abierto}
            aria-activedescendant={indiceFocused >= 0 ? `opcion-${indiceFocused}` : undefined}
            aria-label="Buscar predio por dirección o rol SII"
            placeholder="Buscar dirección o rol SII…"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={manejarTecla}
            onFocus={() => { if (resultados.length > 0) setAbierto(true) }}
            className="
              w-full pl-9 pr-10 py-2 text-sm rounded-lg shadow-md
              bg-white border border-gray-200
              focus:outline-none focus:ring-2 focus:ring-municipal-500 focus:border-transparent
            "
          />

          {/* Spinner o botón limpiar */}
          <div className="absolute right-3">
            {buscando ? (
              <Spinner tamaño="sm" />
            ) : consulta.length > 0 ? (
              <button
                onClick={limpiarBusqueda}
                aria-label="Limpiar búsqueda"
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {/* Dropdown de resultados */}
        {abierto && resultados.length > 0 && (
          <ul
            ref={listaRef}
            id={idLista}
            role="listbox"
            aria-label="Resultados de búsqueda predial"
            aria-live="polite"
            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden max-h-60 overflow-y-auto z-panel"
          >
            {resultados.map((predio, indice) => (
              <li
                key={predio.rol ?? indice}
                id={`opcion-${indice}`}
                role="option"
                aria-selected={indiceFocused === indice}
                onClick={() => seleccionarPredio(predio)}
                onMouseEnter={() => setIndiceFocused(indice)}
                className={`
                  px-4 py-2.5 cursor-pointer text-sm
                  ${indiceFocused === indice ? 'bg-municipal-50 text-municipal-800' : 'hover:bg-gray-50'}
                `}
              >
                <div className="font-medium truncate">{predio.direccion ?? 'Sin dirección'}</div>
                <div className="text-xs text-gray-500">Rol SII: {predio.rol}</div>
              </li>
            ))}
          </ul>
        )}

        {/* Mensaje sin resultados */}
        {abierto && !buscando && consultaDebounced.length >= MIN_CHARS && resultados.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 px-4 py-3 text-sm text-gray-500 text-center">
            No se encontraron predios para "{consultaDebounced}"
          </div>
        )}
      </div>
    </div>
  )
}

export default BuscadorPredial
