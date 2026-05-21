# =============================================================================
# configurar_demo.ps1
# Configura el workspace GeoServer del municipio demo via REST API.
#
# Uso:
#   $env:GEOSERVER_URL      = "http://localhost:8080/geoserver"
#   $env:GEOSERVER_USER     = "admin"
#   $env:GEOSERVER_PASSWORD = "Admin1234"
#   $env:DB_USER            = "sig_usuario"
#   $env:DB_PASSWORD        = "Admin1234"
#   .\configurar_demo.ps1
#
# Prerrequisitos:
#   - GeoServer 2.24.0 corriendo (contenedor sig_geoserver, puerto 8080)
#   - PostgreSQL + PostGIS accesible en sig_postgres con esquema mun_demo
# =============================================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# -----------------------------------------------------------------------------
# Variables con valores por defecto para desarrollo local
# -----------------------------------------------------------------------------
$GeoserverUrl = if ($env:GEOSERVER_URL) { $env:GEOSERVER_URL } else { "http://localhost:8080/geoserver" }
$DbUser       = if ($env:DB_USER)       { $env:DB_USER }       else { "sig_usuario" }
$DbPassword   = if ($env:DB_PASSWORD)   { $env:DB_PASSWORD }   else { "" }

# TEMPORAL: credenciales hardcodeadas para verificar autenticacion con GeoServer.
# Reemplazar por lectura de env vars una vez confirmado que funciona.
$GeoserverUser     = "admin"
$GeoserverPassword = "geoserver"

# Directorio del script para localizar el SLD
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SldFile   = Join-Path $ScriptDir "..\..\estilos\demo_predios_style.sld"

$CodigoMunicipio = "demo"
$NombreDatastore = $CodigoMunicipio + "_postgis"
$NombreCapa      = $CodigoMunicipio + "_predios"
$NombreEstilo    = $CodigoMunicipio + "_predios_style"
$SchemaBd        = "mun_demo"
$BaseDeDatos     = "sig_municipal"
$HostBd          = "sig_postgres"
$PuertoBd        = "5432"

# Nombre completo de capa (workspace:nombre) usado en rutas REST y URLs WMS/WFS.
# Se construye por concatenacion para evitar ambiguedad del parser con ':' en strings.
$LayerFqn = $CodigoMunicipio + ":" + $NombreCapa

# PSCredential es el mecanismo fiable para Basic auth en PowerShell 5.1.
# Invoke-RestMethod con -Headers @{Authorization=...} puede ser ignorado cuando
# el servidor responde con un challenge 401, ya que PS 5.1 intenta negociar
# credenciales Windows en lugar de reenviar el header Basic construido a mano.
$securePass  = ConvertTo-SecureString $GeoserverPassword -AsPlainText -Force
$credencial  = New-Object System.Management.Automation.PSCredential($GeoserverUser, $securePass)
# Header manual como respaldo para llamadas directas con Invoke-RestMethod
$credBytes   = [Text.Encoding]::ASCII.GetBytes($GeoserverUser + ":" + $GeoserverPassword)
$credB64     = [Convert]::ToBase64String($credBytes)
$headersBase = @{ Authorization = "Basic " + $credB64 }

# -----------------------------------------------------------------------------
# Funcion auxiliar: Invoke-GeoserverApi
# Envuelve Invoke-RestMethod con autenticacion y manejo de errores uniforme.
# -----------------------------------------------------------------------------
function Invoke-GeoserverApi {
    param(
        [string] $Metodo,
        [string] $Ruta,
        [string] $TipoContenido = "application/json",
        [object] $Cuerpo = $null
    )

    $url = $script:GeoserverUrl + "/rest" + $Ruta
    $parametros = @{
        Uri            = $url
        Method         = $Metodo
        Credential     = $script:credencial
        # AllowUnencryptedAuthentication no existe en PS 5.1; en su lugar se
        # fuerza el envio del header en el primer intento via Headers.
        Headers        = $script:headersBase
        ErrorAction    = "Stop"
    }

    if ($null -ne $Cuerpo) {
        $parametros.ContentType = $TipoContenido
        if ($Cuerpo -is [string]) {
            $parametros.Body = [Text.Encoding]::UTF8.GetBytes($Cuerpo)
        } else {
            $parametros.Body = $Cuerpo
        }
    }

    try {
        return Invoke-RestMethod @parametros
    } catch {
        $codigoHttp = $_.Exception.Response.StatusCode.value__
        throw ("ERROR " + $Metodo + " " + $url + " - HTTP " + $codigoHttp + ": " + $_.Exception.Message)
    }
}

# Comprueba si un recurso REST ya existe (retorna $true / $false)
function Test-RecursoExiste {
    param([string] $Ruta)
    try {
        $url = $script:GeoserverUrl + "/rest" + $Ruta
        Invoke-RestMethod -Uri $url -Method GET `
            -Credential $script:credencial -Headers $script:headersBase `
            -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "============================================================"
Write-Host " Configurando GeoServer - Municipio Demo"
Write-Host (" URL: " + $GeoserverUrl)
Write-Host "============================================================"
Write-Host ""

# -----------------------------------------------------------------------------
# PASO 1: Verificar que GeoServer esta levantado
# Reintenta 30 veces con pausa de 5 segundos (~2.5 minutos)
# -----------------------------------------------------------------------------
Write-Host "-> Paso 1: Verificando disponibilidad de GeoServer..."

$maxIntentos    = 30
$geoserverListo = $false

for ($i = 1; $i -le $maxIntentos; $i++) {
    Write-Host ("   Intento " + $i + "/" + $maxIntentos + "...")
    try {
        Invoke-RestMethod -Uri ($GeoserverUrl + "/web/") `
            -Method GET -Credential $credencial -Headers $headersBase -ErrorAction Stop | Out-Null
        $geoserverListo = $true
        Write-Host "   OK: GeoServer esta disponible."
        break
    } catch {
        if ($i -lt $maxIntentos) {
            Write-Host "   GeoServer aun no responde. Reintentando en 5 segundos..."
            Start-Sleep -Seconds 5
        }
    }
}

if (-not $geoserverListo) {
    Write-Error ("GeoServer no respondio despues de " + $maxIntentos + " intentos.")
    exit 1
}

# -----------------------------------------------------------------------------
# PASO 2: Crear workspace 'demo'
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host ("-> Paso 2: Creando workspace '" + $CodigoMunicipio + "'...")

if (Test-RecursoExiste ("/workspaces/" + $CodigoMunicipio)) {
    Write-Host ("   El workspace '" + $CodigoMunicipio + "' ya existe. Continuando...")
} else {
    $cuerpo = '{"workspace": {"name": "' + $CodigoMunicipio + '"}}'
    Invoke-GeoserverApi -Metodo POST -Ruta "/workspaces" -Cuerpo $cuerpo | Out-Null
    Write-Host ("   OK: Workspace '" + $CodigoMunicipio + "' creado.")
}

# -----------------------------------------------------------------------------
# PASO 3: Crear datastore 'demo_postgis' apuntando al esquema mun_demo
#
# El JSON de GeoServer usa la clave "$" (signo dolar) para el valor de cada
# parametro de conexion. En PowerShell se escapa con backtick dentro de
# strings con comillas dobles para evitar que el parser lo interpole.
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host ("-> Paso 3: Configurando datastore '" + $NombreDatastore + "' (host: " + $HostBd + ", esquema: " + $SchemaBd + ")...")

# Siempre se aplica la configuracion completa del datastore (POST si no existe, PUT si existe).
# Esto garantiza que un datastore previo con host incorrecto (ej: "localhost") quede corregido.
$entradas = @(
    [ordered]@{ "@key" = "host";                 '$' = $HostBd },
    [ordered]@{ "@key" = "port";                 '$' = $PuertoBd },
    [ordered]@{ "@key" = "database";             '$' = $BaseDeDatos },
    [ordered]@{ "@key" = "schema";               '$' = $SchemaBd },
    [ordered]@{ "@key" = "dbtype";               '$' = "postgis" },
    [ordered]@{ "@key" = "user";                 '$' = $DbUser },
    [ordered]@{ "@key" = "passwd";               '$' = $DbPassword },
    [ordered]@{ "@key" = "min connections";      '$' = "1" },
    [ordered]@{ "@key" = "max connections";      '$' = "10" },
    [ordered]@{ "@key" = "Connection timeout";   '$' = "20" },
    [ordered]@{ "@key" = "validate connections"; '$' = "true" },
    [ordered]@{ "@key" = "preparedStatements";   '$' = "true" },
    [ordered]@{ "@key" = "Expose primary keys";  '$' = "false" },
    [ordered]@{ "@key" = "fetch size";           '$' = "1000" }
)
$datastoreObj = [ordered]@{
    dataStore = [ordered]@{
        name        = $NombreDatastore
        description = "Conexion PostGIS para el municipio demo"
        type        = "PostGIS"
        enabled     = $true
        workspace   = @{ name = $CodigoMunicipio }
        connectionParameters = @{ entry = $entradas }
    }
}
$cuerpo = $datastoreObj | ConvertTo-Json -Depth 10 -Compress
$rutaDs = "/workspaces/" + $CodigoMunicipio + "/datastores/" + $NombreDatastore

if (Test-RecursoExiste $rutaDs) {
    Invoke-GeoserverApi -Metodo PUT -Ruta $rutaDs -Cuerpo $cuerpo | Out-Null
    Write-Host ("   OK: Datastore '" + $NombreDatastore + "' actualizado (host=" + $HostBd + ").")
} else {
    Invoke-GeoserverApi -Metodo POST `
        -Ruta ("/workspaces/" + $CodigoMunicipio + "/datastores") `
        -Cuerpo $cuerpo | Out-Null
    Write-Host ("   OK: Datastore '" + $NombreDatastore + "' creado (host=" + $HostBd + ").")
}

# -----------------------------------------------------------------------------
# PASO 4: Publicar la capa 'predios' como 'demo_predios'
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host ("-> Paso 4: Publicando capa '" + $NombreCapa + "' desde tabla 'predios'...")

$rutaFt = "/workspaces/" + $CodigoMunicipio + "/datastores/" + $NombreDatastore + "/featuretypes/" + $NombreCapa
if (Test-RecursoExiste $rutaFt) {
    Write-Host ("   La capa '" + $NombreCapa + "' ya existe. Continuando...")
} else {
    $ftObj = [ordered]@{
        featureType = [ordered]@{
            name       = $NombreCapa
            nativeName = "predios"
            title      = "Predios - Municipio Demo"
            abstract   = "Catastro predial del municipio de demostracion."
            keywords   = @{ string = @("predios", "catastro", "demo") }
            srs        = "EPSG:4326"
            nativeCRS  = "EPSG:4326"
            nativeBoundingBox  = @{ minx = -75.0; miny = -55.0; maxx = -66.0; maxy = -17.0; crs = "EPSG:4326" }
            latLonBoundingBox  = @{ minx = -75.0; miny = -55.0; maxx = -66.0; maxy = -17.0; crs = "EPSG:4326" }
            enabled     = $true
            maxFeatures = 5000
            numDecimals = 6
        }
    }
    $cuerpo = $ftObj | ConvertTo-Json -Depth 10 -Compress
    Invoke-GeoserverApi -Metodo POST `
        -Ruta ("/workspaces/" + $CodigoMunicipio + "/datastores/" + $NombreDatastore + "/featuretypes") `
        -Cuerpo $cuerpo | Out-Null
    Write-Host ("   OK: Capa '" + $NombreCapa + "' publicada (SRS: EPSG:4326).")
}

# -----------------------------------------------------------------------------
# PASO 5: Subir el estilo SLD
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host ("-> Paso 5: Subiendo estilo SLD '" + $NombreEstilo + "'...")

if (-not (Test-Path $SldFile)) {
    Write-Error ("No se encontro el archivo SLD en: " + $SldFile)
    exit 1
}

$sldContenido = [IO.File]::ReadAllBytes($SldFile)

if (Test-RecursoExiste ("/styles/" + $NombreEstilo)) {
    Write-Host ("   El estilo '" + $NombreEstilo + "' ya existe. Actualizando...")
    Invoke-GeoserverApi -Metodo PUT -Ruta ("/styles/" + $NombreEstilo) `
        -TipoContenido "application/vnd.ogc.sld+xml" -Cuerpo $sldContenido | Out-Null
    Write-Host ("   OK: Estilo '" + $NombreEstilo + "' actualizado.")
} else {
    $registroEstilo = '{"style": {"name": "' + $NombreEstilo + '", "filename": "' + $NombreEstilo + '.sld"}}'
    Invoke-GeoserverApi -Metodo POST -Ruta "/styles" -Cuerpo $registroEstilo | Out-Null
    Invoke-GeoserverApi -Metodo PUT -Ruta ("/styles/" + $NombreEstilo) `
        -TipoContenido "application/vnd.ogc.sld+xml" -Cuerpo $sldContenido | Out-Null
    Write-Host ("   OK: Estilo '" + $NombreEstilo + "' creado y subido.")
}

# -----------------------------------------------------------------------------
# PASO 6: Asignar el estilo como predeterminado de la capa
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host ("-> Paso 6: Asignando estilo '" + $NombreEstilo + "' a la capa '" + $NombreCapa + "'...")

$cuerpo = '{"layer": {"defaultStyle": {"name": "' + $NombreEstilo + '"}}}'
Invoke-GeoserverApi -Metodo PUT -Ruta ("/layers/" + $LayerFqn) -Cuerpo $cuerpo | Out-Null
Write-Host "   OK: Estilo asignado como predeterminado."

# -----------------------------------------------------------------------------
# PASO 7: Verificar GetCapabilities
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "-> Paso 7: Verificando respuesta WMS GetCapabilities..."

# URL construida por concatenacion para evitar conflictos del parser con '&' en strings largos
$urlCaps = $GeoserverUrl + "/" + $CodigoMunicipio + "/wms?service=WMS&version=1.3.0&request=GetCapabilities"
try {
    $caps = Invoke-RestMethod -Uri $urlCaps -Method GET -Credential $credencial -Headers $headersBase -ErrorAction Stop
    if ($caps -match $NombreCapa) {
        Write-Host ("   OK: La capa '" + $NombreCapa + "' aparece en GetCapabilities.")
    } else {
        Write-Host ("   AVISO: La capa podria no aparecer aun. Verifica en: " + $urlCaps)
    }
} catch {
    Write-Host ("   AVISO: No se pudo verificar GetCapabilities: " + $_.Exception.Message)
}

# -----------------------------------------------------------------------------
# Resumen final
# Las URLs se construyen por concatenacion — el '&' dentro de strings dobles
# puede causar errores de parseo en PowerShell 5.1 cuando la linea es muy larga.
# -----------------------------------------------------------------------------
$urlWmsCaps = $GeoserverUrl + "/" + $CodigoMunicipio + "/wms?service=WMS&version=1.3.0&request=GetCapabilities"
$urlWmsMap  = $GeoserverUrl + "/" + $CodigoMunicipio + "/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap" `
            + "&FORMAT=image/png&TRANSPARENT=true&LAYERS=" + $LayerFqn `
            + "&CRS=EPSG:4326&WIDTH=800&HEIGHT=600&BBOX=-73.1,-37.1,-72.9,-36.9"
$urlWfs     = $GeoserverUrl + "/" + $CodigoMunicipio + "/wfs?service=WFS&version=2.0.0&request=GetFeature" `
            + "&typeNames=" + $LayerFqn + "&outputFormat=application/json&count=10"
$urlAdmin   = $GeoserverUrl + "/web/"

Write-Host ""
Write-Host "============================================================"
Write-Host " Configuracion del municipio demo COMPLETADA"
Write-Host "============================================================"
Write-Host ""
Write-Host "-> Recursos disponibles:"
Write-Host ""
Write-Host "   WMS GetCapabilities:"
Write-Host ("   " + $urlWmsCaps)
Write-Host ""
Write-Host "   WMS GetMap (zona Concepcion, Chile):"
Write-Host ("   " + $urlWmsMap)
Write-Host ""
Write-Host "   WFS GetFeature (JSON - primeros 10 predios):"
Write-Host ("   " + $urlWfs)
Write-Host ""
Write-Host "   Panel de administracion GeoServer:"
Write-Host ("   " + $urlAdmin)
Write-Host ""
