#!/usr/bin/env bash
# =============================================================================
# configurar_demo.sh
# Script de configuración automática del workspace GeoServer para municipio demo.
#
# Uso:
#   GEOSERVER_URL=http://localhost:8080/geoserver \
#   GEOSERVER_USER=admin \
#   GEOSERVER_PASSWORD=geoserver \
#   DB_USER=sig_app \
#   DB_PASSWORD=sig_app_password \
#   ./configurar_demo.sh
#
# Este script configura en GeoServer:
#   1. Workspace 'demo'
#   2. Datastore PostGIS 'demo_postgis' apuntando al esquema mun_demo
#   3. Capa 'predios' publicada como 'demo_predios'
#   4. Estilo SLD 'demo_predios_style'
#   5. Asignación del estilo a la capa
#
# Prerrequisitos:
#   - GeoServer 2.24.0 corriendo (contenedor sig_geoserver)
#   - PostgreSQL + PostGIS accesible en sig_postgres con esquema mun_demo
#   - curl disponible en el sistema
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Variables de entorno con valores por defecto para desarrollo local
# -----------------------------------------------------------------------------
GEOSERVER_URL="${GEOSERVER_URL:-http://localhost:8080/geoserver}"
GEOSERVER_USER="${GEOSERVER_USER:-admin}"
GEOSERVER_PASSWORD="${GEOSERVER_PASSWORD:-geoserver}"
DB_USER="${DB_USER:-sig_app}"
DB_PASSWORD="${DB_PASSWORD:-sig_app_password}"

# Directorio raíz del script (para localizar el archivo SLD)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# El SLD está en geoserver/estilos/ relativo a la raíz del proyecto
SLD_FILE="${SCRIPT_DIR}/../../estilos/demo_predios_style.sld"

# Nombre del municipio de demostración
CODIGO_MUNICIPIO="demo"
NOMBRE_DATASTORE="${CODIGO_MUNICIPIO}_postgis"
NOMBRE_CAPA="${CODIGO_MUNICIPIO}_predios"
NOMBRE_ESTILO="${CODIGO_MUNICIPIO}_predios_style"
SCHEMA_BD="mun_demo"
BASE_DE_DATOS="sig_municipal"
HOST_BD="sig_postgres"
PUERTO_BD="5432"

# -----------------------------------------------------------------------------
# Función auxiliar: llamar_api
# Encapsula curl con autenticación básica y manejo de errores.
# Uso: llamar_api <METODO> <RUTA> [CONTENT_TYPE] [DATOS]
# -----------------------------------------------------------------------------
llamar_api() {
    local metodo="$1"
    local ruta="$2"
    local tipo_contenido="${3:-application/json}"
    local datos="${4:-}"

    local url="${GEOSERVER_URL}/rest${ruta}"
    local args=(-s -f -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" -X "${metodo}")

    if [[ -n "$datos" ]]; then
        args+=(-H "Content-Type: ${tipo_contenido}" -d "${datos}")
    fi

    local respuesta
    if ! respuesta=$(curl "${args[@]}" "${url}" 2>&1); then
        echo "  ERROR: Falló la petición ${metodo} ${url}" >&2
        echo "  Detalle: ${respuesta}" >&2
        return 1
    fi

    echo "${respuesta}"
    return 0
}

# Variante de llamar_api para enviar archivos (multipart o body de archivo)
llamar_api_archivo() {
    local metodo="$1"
    local ruta="$2"
    local tipo_contenido="$3"
    local ruta_archivo="$4"

    local url="${GEOSERVER_URL}/rest${ruta}"

    local respuesta
    if ! respuesta=$(curl -s -f \
        -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
        -X "${metodo}" \
        -H "Content-Type: ${tipo_contenido}" \
        --data-binary "@${ruta_archivo}" \
        "${url}" 2>&1); then
        echo "  ERROR: Falló el envío de archivo ${metodo} ${url}" >&2
        echo "  Detalle: ${respuesta}" >&2
        return 1
    fi

    echo "${respuesta}"
    return 0
}

# -----------------------------------------------------------------------------
# PASO 1: Verificar que GeoServer está levantado
# Reintenta hasta 30 veces con pausa de 5 segundos (total: ~2.5 minutos)
# -----------------------------------------------------------------------------
echo ""
echo "============================================================"
echo " Configurando GeoServer — Municipio Demo"
echo " URL: ${GEOSERVER_URL}"
echo "============================================================"
echo ""
echo "→ Paso 1: Verificando disponibilidad de GeoServer..."

MAX_INTENTOS=30
INTENTO=0
GEOSERVER_LISTO=false

while [[ $INTENTO -lt $MAX_INTENTOS ]]; do
    INTENTO=$((INTENTO + 1))
    echo "  Intento ${INTENTO}/${MAX_INTENTOS}..."

    if curl -s -f -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
        "${GEOSERVER_URL}/web/" > /dev/null 2>&1; then
        GEOSERVER_LISTO=true
        echo "  ✓ GeoServer está disponible."
        break
    fi

    if [[ $INTENTO -lt $MAX_INTENTOS ]]; then
        echo "  GeoServer aún no responde. Reintentando en 5 segundos..."
        sleep 5
    fi
done

if [[ "$GEOSERVER_LISTO" != "true" ]]; then
    echo "  ERROR: GeoServer no respondió después de ${MAX_INTENTOS} intentos." >&2
    echo "  Verifica que el contenedor sig_geoserver esté en ejecución." >&2
    exit 1
fi

# -----------------------------------------------------------------------------
# PASO 2: Crear workspace 'demo'
# -----------------------------------------------------------------------------
echo ""
echo "→ Paso 2: Creando workspace '${CODIGO_MUNICIPIO}'..."

PAYLOAD_WORKSPACE="{
  \"workspace\": {
    \"name\": \"${CODIGO_MUNICIPIO}\"
  }
}"

# Verificar si el workspace ya existe para evitar error 409
if curl -s -f -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
    "${GEOSERVER_URL}/rest/workspaces/${CODIGO_MUNICIPIO}" > /dev/null 2>&1; then
    echo "  El workspace '${CODIGO_MUNICIPIO}' ya existe. Continuando..."
else
    llamar_api POST "/workspaces" "application/json" "${PAYLOAD_WORKSPACE}" > /dev/null
    echo "  ✓ Workspace '${CODIGO_MUNICIPIO}' creado correctamente."
fi

# -----------------------------------------------------------------------------
# PASO 3: Crear datastore 'demo_postgis' apuntando al esquema mun_demo
# -----------------------------------------------------------------------------
echo ""
echo "→ Paso 3: Creando datastore '${NOMBRE_DATASTORE}' (esquema: ${SCHEMA_BD})..."

PAYLOAD_DATASTORE="{
  \"dataStore\": {
    \"name\": \"${NOMBRE_DATASTORE}\",
    \"description\": \"Conexion PostGIS para el municipio demo\",
    \"type\": \"PostGIS\",
    \"enabled\": true,
    \"workspace\": {
      \"name\": \"${CODIGO_MUNICIPIO}\"
    },
    \"connectionParameters\": {
      \"entry\": [
        { \"@key\": \"host\",                \"$\": \"${HOST_BD}\" },
        { \"@key\": \"port\",                \"$\": \"${PUERTO_BD}\" },
        { \"@key\": \"database\",            \"$\": \"${BASE_DE_DATOS}\" },
        { \"@key\": \"schema\",              \"$\": \"${SCHEMA_BD}\" },
        { \"@key\": \"dbtype\",              \"$\": \"postgis\" },
        { \"@key\": \"user\",                \"$\": \"${DB_USER}\" },
        { \"@key\": \"passwd\",              \"$\": \"${DB_PASSWORD}\" },
        { \"@key\": \"min connections\",     \"$\": \"1\" },
        { \"@key\": \"max connections\",     \"$\": \"10\" },
        { \"@key\": \"Connection timeout\",  \"$\": \"20\" },
        { \"@key\": \"validate connections\",\"$\": \"true\" },
        { \"@key\": \"preparedStatements\",  \"$\": \"true\" },
        { \"@key\": \"Expose primary keys\", \"$\": \"false\" },
        { \"@key\": \"fetch size\",          \"$\": \"1000\" }
      ]
    }
  }
}"

# Verificar si el datastore ya existe
if curl -s -f -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
    "${GEOSERVER_URL}/rest/workspaces/${CODIGO_MUNICIPIO}/datastores/${NOMBRE_DATASTORE}" \
    > /dev/null 2>&1; then
    echo "  El datastore '${NOMBRE_DATASTORE}' ya existe. Continuando..."
else
    llamar_api POST \
        "/workspaces/${CODIGO_MUNICIPIO}/datastores" \
        "application/json" \
        "${PAYLOAD_DATASTORE}" > /dev/null
    echo "  ✓ Datastore '${NOMBRE_DATASTORE}' creado (esquema: ${SCHEMA_BD})."
fi

# -----------------------------------------------------------------------------
# PASO 4: Publicar la capa 'predios' como 'demo_predios'
# -----------------------------------------------------------------------------
echo ""
echo "→ Paso 4: Publicando capa '${NOMBRE_CAPA}' desde tabla 'predios'..."

PAYLOAD_FEATURETYPE="{
  \"featureType\": {
    \"name\": \"${NOMBRE_CAPA}\",
    \"nativeName\": \"predios\",
    \"title\": \"Predios - Municipio Demo\",
    \"abstract\": \"Catastro predial del municipio de demostracion. Incluye rol SII, direccion, propietario, superficie, zona y uso de suelo.\",
    \"keywords\": {
      \"string\": [\"predios\", \"catastro\", \"demo\", \"municipio\"]
    },
    \"srs\": \"EPSG:4326\",
    \"nativeCRS\": \"EPSG:4326\",
    \"nativeBoundingBox\": {
      \"minx\": -75.0,
      \"miny\": -55.0,
      \"maxx\": -66.0,
      \"maxy\": -17.0,
      \"crs\": \"EPSG:4326\"
    },
    \"latLonBoundingBox\": {
      \"minx\": -75.0,
      \"miny\": -55.0,
      \"maxx\": -66.0,
      \"maxy\": -17.0,
      \"crs\": \"EPSG:4326\"
    },
    \"enabled\": true,
    \"maxFeatures\": 5000,
    \"numDecimals\": 6
  }
}"

# Verificar si la capa ya existe
if curl -s -f -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
    "${GEOSERVER_URL}/rest/workspaces/${CODIGO_MUNICIPIO}/datastores/${NOMBRE_DATASTORE}/featuretypes/${NOMBRE_CAPA}" \
    > /dev/null 2>&1; then
    echo "  La capa '${NOMBRE_CAPA}' ya existe. Continuando..."
else
    llamar_api POST \
        "/workspaces/${CODIGO_MUNICIPIO}/datastores/${NOMBRE_DATASTORE}/featuretypes" \
        "application/json" \
        "${PAYLOAD_FEATURETYPE}" > /dev/null
    echo "  ✓ Capa '${NOMBRE_CAPA}' publicada (SRS: EPSG:4326)."
fi

# -----------------------------------------------------------------------------
# PASO 5: Subir el estilo SLD 'demo_predios_style'
# -----------------------------------------------------------------------------
echo ""
echo "→ Paso 5: Subiendo estilo SLD '${NOMBRE_ESTILO}'..."

# Verificar que el archivo SLD existe
if [[ ! -f "$SLD_FILE" ]]; then
    echo "  ERROR: No se encontró el archivo SLD en: ${SLD_FILE}" >&2
    echo "  Asegúrate de ejecutar el script desde el directorio correcto." >&2
    exit 1
fi

# Verificar si el estilo ya existe en GeoServer
if curl -s -f -u "${GEOSERVER_USER}:${GEOSERVER_PASSWORD}" \
    "${GEOSERVER_URL}/rest/styles/${NOMBRE_ESTILO}" > /dev/null 2>&1; then
    echo "  El estilo '${NOMBRE_ESTILO}' ya existe. Actualizando contenido..."
    llamar_api_archivo PUT \
        "/styles/${NOMBRE_ESTILO}" \
        "application/vnd.ogc.sld+xml" \
        "${SLD_FILE}" > /dev/null
    echo "  ✓ Estilo '${NOMBRE_ESTILO}' actualizado."
else
    # Crear el estilo primero (registro) y luego subir el SLD
    PAYLOAD_ESTILO="{\"style\": {\"name\": \"${NOMBRE_ESTILO}\", \"filename\": \"${NOMBRE_ESTILO}.sld\"}}"
    llamar_api POST "/styles" "application/json" "${PAYLOAD_ESTILO}" > /dev/null

    llamar_api_archivo PUT \
        "/styles/${NOMBRE_ESTILO}" \
        "application/vnd.ogc.sld+xml" \
        "${SLD_FILE}" > /dev/null
    echo "  ✓ Estilo '${NOMBRE_ESTILO}' creado y subido."
fi

# -----------------------------------------------------------------------------
# PASO 6: Asignar el estilo como estilo por defecto de la capa
# -----------------------------------------------------------------------------
echo ""
echo "→ Paso 6: Asignando estilo '${NOMBRE_ESTILO}' a la capa '${NOMBRE_CAPA}'..."

PAYLOAD_LAYER_STYLE="{
  \"layer\": {
    \"defaultStyle\": {
      \"name\": \"${NOMBRE_ESTILO}\"
    }
  }
}"

llamar_api PUT \
    "/layers/${CODIGO_MUNICIPIO}:${NOMBRE_CAPA}" \
    "application/json" \
    "${PAYLOAD_LAYER_STYLE}" > /dev/null

echo "  ✓ Estilo '${NOMBRE_ESTILO}' asignado como estilo por defecto."

# -----------------------------------------------------------------------------
# PASO 7: Verificar que la capa responde a GetCapabilities
# -----------------------------------------------------------------------------
echo ""
echo "→ Paso 7: Verificando respuesta WMS GetCapabilities..."

URL_CAPABILITIES="${GEOSERVER_URL}/${CODIGO_MUNICIPIO}/wms?service=WMS&version=1.3.0&request=GetCapabilities"

if curl -s -f "${URL_CAPABILITIES}" | grep -q "${NOMBRE_CAPA}" 2>/dev/null; then
    echo "  ✓ La capa '${NOMBRE_CAPA}' aparece en GetCapabilities. ¡Configuración exitosa!"
else
    echo "  AVISO: La capa podría no aparecer aún en GetCapabilities." >&2
    echo "  Esto puede ocurrir si GeoServer necesita unos segundos para indexar la capa." >&2
    echo "  Verifica manualmente en: ${URL_CAPABILITIES}" >&2
fi

# -----------------------------------------------------------------------------
# Resumen final
# -----------------------------------------------------------------------------
echo ""
echo "============================================================"
echo " Configuración del municipio demo COMPLETADA"
echo "============================================================"
echo ""
echo "→ Recursos disponibles:"
echo ""
echo "  WMS GetCapabilities:"
echo "  ${GEOSERVER_URL}/${CODIGO_MUNICIPIO}/wms?service=WMS&version=1.3.0&request=GetCapabilities"
echo ""
echo "  WMS GetMap (vista de prueba — Concepción, Chile):"
echo "  ${GEOSERVER_URL}/${CODIGO_MUNICIPIO}/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap"
echo "  &FORMAT=image/png&TRANSPARENT=true&LAYERS=${CODIGO_MUNICIPIO}:${NOMBRE_CAPA}"
echo "  &CRS=EPSG:4326&STYLES=&WIDTH=800&HEIGHT=600"
echo "  &BBOX=-73.1,-37.1,-72.9,-36.9"
echo ""
echo "  WFS GetFeature (JSON — primeros 10 predios):"
echo "  ${GEOSERVER_URL}/${CODIGO_MUNICIPIO}/wfs?service=WFS&version=2.0.0&request=GetFeature"
echo "  &typeNames=${CODIGO_MUNICIPIO}:${NOMBRE_CAPA}&outputFormat=application/json&count=10"
echo ""
echo "  Admin GeoServer:"
echo "  ${GEOSERVER_URL}/web/"
echo ""
echo "→ Para probar en MapLibre GL JS, usar la URL WMS como fuente tipo 'raster'."
echo "  Ver frontend/src/ para integración con la plataforma SIG Municipal."
echo ""
