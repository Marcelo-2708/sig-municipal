<?xml version="1.0" encoding="UTF-8"?>
<!--
  Estilo SLD para la capa de predios del municipio demo.
  Convención de nombres: {codigo_municipio}_{capa}_style

  Reglas definidas:
    1. Base (genérico):      fondo crema #F5F0E8, borde café #8B7355
    2. Residencial:          fondo verde suave #D4E8C2
    3. Comercial:            fondo naranja suave #E8D4C2
    4. Industrial:           fondo azul suave #C2C8E8
    5. Etiquetas dirección:  texto Arial 8pt, solo a escala > 1:5000

  Todas las reglas de polígono aplican hasta escala 1:50000 (MaxScaleDenominator=50000).
  Las etiquetas aplican solo cuando se acerca más (MaxScaleDenominator=5000).
-->
<StyledLayerDescriptor
  version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/sld
    http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">

  <NamedLayer>
    <Name>demo_predios_style</Name>
    <UserStyle>
      <Name>demo_predios_style</Name>
      <Title>Estilo predios municipio demo</Title>
      <Abstract>Visualización catastral de predios con clasificación por uso de suelo</Abstract>

      <FeatureTypeStyle>

        <!-- ============================================================ -->
        <!-- REGLA 1: Predios genéricos (sin filtro — estilo base)        -->
        <!-- Se muestra para todos los predios que no coincidan con las   -->
        <!-- reglas específicas de uso de suelo.                          -->
        <!-- ============================================================ -->
        <Rule>
          <Name>predios_base</Name>
          <Title>Predio (genérico)</Title>
          <!-- Solo renderizar hasta zoom equivalente a 1:50000 -->
          <MaxScaleDenominator>50000</MaxScaleDenominator>
          <PolygonSymbolizer>
            <Fill>
              <CssParameter name="fill">#F5F0E8</CssParameter>
              <CssParameter name="fill-opacity">0.6</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#8B7355</CssParameter>
              <CssParameter name="stroke-width">0.5</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>

        <!-- ============================================================ -->
        <!-- REGLA 2: Predios residenciales                               -->
        <!-- Filtro: uso_suelo = 'residencial'                            -->
        <!-- ============================================================ -->
        <Rule>
          <Name>predios_residencial</Name>
          <Title>Predio residencial</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>uso_suelo</ogc:PropertyName>
              <ogc:Literal>residencial</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <MaxScaleDenominator>50000</MaxScaleDenominator>
          <PolygonSymbolizer>
            <Fill>
              <!-- Verde suave — zona habitacional -->
              <CssParameter name="fill">#D4E8C2</CssParameter>
              <CssParameter name="fill-opacity">0.75</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#8B7355</CssParameter>
              <CssParameter name="stroke-width">0.5</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>

        <!-- ============================================================ -->
        <!-- REGLA 3: Predios comerciales                                 -->
        <!-- Filtro: uso_suelo = 'comercial'                              -->
        <!-- ============================================================ -->
        <Rule>
          <Name>predios_comercial</Name>
          <Title>Predio comercial</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>uso_suelo</ogc:PropertyName>
              <ogc:Literal>comercial</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <MaxScaleDenominator>50000</MaxScaleDenominator>
          <PolygonSymbolizer>
            <Fill>
              <!-- Naranja suave — zona de actividad comercial -->
              <CssParameter name="fill">#E8D4C2</CssParameter>
              <CssParameter name="fill-opacity">0.75</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#8B7355</CssParameter>
              <CssParameter name="stroke-width">0.5</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>

        <!-- ============================================================ -->
        <!-- REGLA 4: Predios industriales                                -->
        <!-- Filtro: uso_suelo = 'industrial'                             -->
        <!-- ============================================================ -->
        <Rule>
          <Name>predios_industrial</Name>
          <Title>Predio industrial</Title>
          <ogc:Filter>
            <ogc:PropertyIsEqualTo>
              <ogc:PropertyName>uso_suelo</ogc:PropertyName>
              <ogc:Literal>industrial</ogc:Literal>
            </ogc:PropertyIsEqualTo>
          </ogc:Filter>
          <MaxScaleDenominator>50000</MaxScaleDenominator>
          <PolygonSymbolizer>
            <Fill>
              <!-- Azul suave — zona de uso industrial -->
              <CssParameter name="fill">#C2C8E8</CssParameter>
              <CssParameter name="fill-opacity">0.75</CssParameter>
            </Fill>
            <Stroke>
              <CssParameter name="stroke">#8B7355</CssParameter>
              <CssParameter name="stroke-width">0.5</CssParameter>
            </Stroke>
          </PolygonSymbolizer>
        </Rule>

        <!-- ============================================================ -->
        <!-- REGLA 5: Etiquetas de dirección                              -->
        <!-- Solo visible a escala detallada (< 1:5000)                  -->
        <!-- Fuente Arial 8pt, color oscuro, halo blanco para legibilidad -->
        <!-- ============================================================ -->
        <Rule>
          <Name>etiquetas_direccion</Name>
          <Title>Etiqueta de dirección</Title>
          <!-- Las etiquetas solo aparecen cuando se hace zoom mayor a 1:5000 -->
          <MaxScaleDenominator>5000</MaxScaleDenominator>
          <TextSymbolizer>
            <Label>
              <ogc:PropertyName>direccion</ogc:PropertyName>
            </Label>
            <Font>
              <CssParameter name="font-family">Arial</CssParameter>
              <CssParameter name="font-size">8</CssParameter>
              <CssParameter name="font-style">normal</CssParameter>
              <CssParameter name="font-weight">normal</CssParameter>
            </Font>
            <LabelPlacement>
              <PointPlacement>
                <AnchorPoint>
                  <AnchorPointX>0.5</AnchorPointX>
                  <AnchorPointY>0.5</AnchorPointY>
                </AnchorPoint>
              </PointPlacement>
            </LabelPlacement>
            <!-- Halo blanco de 1px para asegurar legibilidad sobre cualquier fondo -->
            <Halo>
              <Radius>1</Radius>
              <Fill>
                <CssParameter name="fill">#FFFFFF</CssParameter>
                <CssParameter name="fill-opacity">0.85</CssParameter>
              </Fill>
            </Halo>
            <Fill>
              <CssParameter name="fill">#333333</CssParameter>
            </Fill>
            <VendorOption name="maxDisplacement">5</VendorOption>
            <VendorOption name="conflictResolution">true</VendorOption>
          </TextSymbolizer>
        </Rule>

      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
