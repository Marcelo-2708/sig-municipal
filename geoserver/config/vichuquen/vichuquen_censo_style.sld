<?xml version="1.0" encoding="UTF-8"?>
<!--
  Estilo SLD para la capa censo (manzanas censales) del municipio de Vichuquen.
  Relleno blanco semi-transparente con borde azul para ver el satelite por debajo.
  Campo de geometria: wkb_geometry.
  Compatible con GeoServer 2.25 / SLD 1.0.
-->
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>vichuquen:censo</Name>
    <UserStyle>
      <Title>Manzanas Censales Vichuquen</Title>
      <Abstract>Manzanas del Censo INE 2017 - relleno translucido con borde azul</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <Name>manzana_censal</Name>
          <Title>Manzana Censal</Title>
          <PolygonSymbolizer>
            <Fill>
              <CssParameter name="fill">#E3F2FD</CssParameter>
              <CssParameter name="fill-opacity">0.25</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#1565C0</CssParameter>
              <CssParameter name="stroke-width">1.2</CssParameter>
              <CssParameter name="stroke-opacity">0.85</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
