/**
 * Pruebas unitarias para las utilidades de mapa.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock de maplibre-gl ────────────────────────────────────────────────────
vi.mock('maplibre-gl', () => ({
  default: {},
}))

// Importaciones después del mock
import { sincronizarCapas, quitarCapa } from '../services/mapaUtils.js'

// Crea un mock del objeto Map de MapLibre
function crearMapaMock(capasExistentes = [], fuentesExistentes = []) {
  const capas   = new Set(capasExistentes)
  const fuentes = new Set(fuentesExistentes)

  return {
    loaded: vi.fn(() => true),
    getLayer:  (id) => capas.has(id) ? { id } : undefined,
    getSource: (id) => fuentes.has(id) ? { id } : undefined,
    addSource: vi.fn((id) => fuentes.add(id)),
    addLayer:  vi.fn((def) => capas.add(def.id)),
    removeLayer:  vi.fn((id) => capas.delete(id)),
    removeSource: vi.fn((id) => fuentes.delete(id)),
    setPaintProperty: vi.fn(),
    getStyle: vi.fn(() => ({
      layers: [...capas].map((id) => ({ id })),
    })),
  }
}

describe('sincronizarCapas', () => {
  it('agrega una capa WMS nueva al mapa', () => {
    const mapa = crearMapaMock()
    const capasActivas = [{ id: 'calles', nombre_geoserver: 'municipio:calles', opacidad: 1 }]

    sincronizarCapas(mapa, capasActivas, 'http://localhost:8080/geoserver')

    expect(mapa.addSource).toHaveBeenCalledOnce()
    expect(mapa.addLayer).toHaveBeenCalledOnce()
  })

  it('no agrega una capa que ya existe', () => {
    const mapa = crearMapaMock(['wms-calles'], ['wms-src-calles'])
    const capasActivas = [{ id: 'calles', nombre_geoserver: 'municipio:calles', opacidad: 1 }]

    sincronizarCapas(mapa, capasActivas, 'http://localhost:8080/geoserver')

    expect(mapa.addSource).not.toHaveBeenCalled()
    expect(mapa.addLayer).not.toHaveBeenCalled()
    // Debe actualizar la opacidad
    expect(mapa.setPaintProperty).toHaveBeenCalledWith('wms-calles', 'raster-opacity', 1)
  })

  it('elimina capas que ya no están activas', () => {
    const mapa = crearMapaMock(['wms-calles', 'wms-predios'], ['wms-src-calles', 'wms-src-predios'])
    // Solo 'predios' sigue activa
    const capasActivas = [{ id: 'predios', nombre_geoserver: 'municipio:predios', opacidad: 0.8 }]

    sincronizarCapas(mapa, capasActivas, 'http://localhost:8080/geoserver')

    expect(mapa.removeLayer).toHaveBeenCalledWith('wms-calles')
    expect(mapa.removeSource).toHaveBeenCalledWith('wms-src-calles')
  })

  it('no hace nada si el mapa no está listo', () => {
    const mapa = crearMapaMock()
    mapa.loaded = vi.fn(() => false)

    sincronizarCapas(mapa, [{ id: 'test' }], 'http://localhost:8080/geoserver')

    expect(mapa.addLayer).not.toHaveBeenCalled()
  })
})

describe('quitarCapa', () => {
  it('elimina capa y fuente existentes', () => {
    const mapa = crearMapaMock(['wms-zona'], ['wms-src-zona'])
    quitarCapa(mapa, 'zona')
    expect(mapa.removeLayer).toHaveBeenCalledWith('wms-zona')
    expect(mapa.removeSource).toHaveBeenCalledWith('wms-src-zona')
  })

  it('no falla si la capa no existe', () => {
    const mapa = crearMapaMock()
    expect(() => quitarCapa(mapa, 'inexistente')).not.toThrow()
  })
})
