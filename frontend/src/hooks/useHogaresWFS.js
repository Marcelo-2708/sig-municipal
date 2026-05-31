/**
 * useHogaresWFS.js
 * Carga features de hogares desde GeoServer WFS.
 * Retorna { features, loading, error }
 * Solo campos necesarios para el panel censal.
 * Coloca en: frontend/src/hooks/useHogaresWFS.js
 */
import { useState, useEffect } from 'react'

const CAMPOS = [
  'wkb_geometry',
  'n_hog','n_per','n_hombres','n_mujeres','prom_edad',
  'n_inmigran','n_pueblos_','n_afrodesc',
  'n_edad_0_5','n_edad_6_1','n_edad_14_','n_edad_18_','n_edad_25_','n_edad_45_','n_edad_60_',
  'prom_escol','n_analfabe','n_cine_nun','n_cine_pri','n_cine_sec','n_cine_ter',
  'n_ocupado','n_desocupa','n_fuera_fu',
  'prom_per_h','n_vp','n_vp_ocupa','n_viv_haci','n_deficit_','n_hog_unip','n_hog_60',
  'n_serv_tel','n_serv_int','n_internet','n_fuente_a','n_serv_hig','n_fuente_e','n_basura_s',
  'localidad','comuna','region','categoria','area_c',
].join(',')

export function useHogaresWFS(geoserverUrl) {
  const [features, setFeatures] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    if (!geoserverUrl) return
    let cancelado = false

    const url =
      `${geoserverUrl}/wfs` +
      `?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
      `&TYPENAMES=vichuquen:hogares` +
      `&OUTPUTFORMAT=application/json` +
      `&PROPERTYNAME=${CAMPOS}`

    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`WFS ${r.status}`); return r.json() })
      .then((geojson) => {
        if (cancelado) return
        setFeatures(geojson.features ?? [])
        setLoading(false)
      })
      .catch((err) => {
        if (cancelado) return
        setError(err.message)
        setLoading(false)
      })

    return () => { cancelado = true }
  }, [geoserverUrl])

  return { features, loading, error }
}
