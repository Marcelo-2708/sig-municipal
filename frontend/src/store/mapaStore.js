import { create } from 'zustand'
import { CENTRO_INICIAL, ZOOM_INICIAL } from '../config/mapas.js'

/**
 * Store del mapa.
 * Almacena la referencia al objeto MapLibre y el estado de visualización.
 * La referencia (mapaRef) NO se persiste — es un objeto del DOM.
 */
const useMapaStore = create((set) => ({
  // Referencia al objeto MapLibre GL (se asigna tras la inicialización)
  mapaRef: null,

  // Posición y zoom actuales del mapa
  centroActual: CENTRO_INICIAL,
  zoomActual: ZOOM_INICIAL,

  // Predio actualmente resaltado (GeoJSON Feature o null)
  predioResaltado: null,

  // Manzana censal seleccionada al hacer click en capa hogares
  manzanaSeleccionada: null,

  // Flag síncrono: true cuando un click de capa hogares ya fue procesado.
  // useGetFeatureInfo lo lee vía getState() y lo resetea a false.
  clickBloqueado: false,

  /**
   * Guarda la referencia al objeto MapLibre una vez inicializado.
   * @param {maplibregl.Map} mapa
   */
  setMapaRef: (mapa) => set({ mapaRef: mapa }),

  /**
   * Actualiza el centro del mapa en el store (sin mover el mapa).
   * @param {[number, number]} centro - [longitud, latitud] en WGS84
   */
  setCentro: (centro) => set({ centroActual: centro }),

  /**
   * Actualiza el zoom en el store (sin mover el mapa).
   * @param {number} zoom
   */
  setZoom: (zoom) => set({ zoomActual: zoom }),

  /**
   * Marca un predio como resaltado en el mapa.
   * @param {object|null} geojson - Feature GeoJSON del predio
   */
  setPredioResaltado: (geojson) => set({ predioResaltado: geojson }),

  /**
   * Guarda las propiedades de la manzana censal seleccionada (null para cerrar).
   * @param {object|null} datos - Propiedades del feature + _num de manzana
   */
  setManzanaSeleccionada: (datos) => set({ manzanaSeleccionada: datos }),

  /**
   * Activa o desactiva el bloqueo del GetFeatureInfo genérico.
   * @param {boolean} valor
   */
  setClickBloqueado: (valor) => set({ clickBloqueado: valor }),

  /**
   * Limpia la referencia al mapa (llamado en cleanup de useEffect).
   */
  limpiarMapa: () => set({ mapaRef: null, predioResaltado: null, manzanaSeleccionada: null, clickBloqueado: false }),
}))

export default useMapaStore
