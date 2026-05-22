# =============================================================================
# publicar_capas_demo.ps1
# Publica las capas inacap_ccp_thno y eem_idoneos en GeoServer.
# Idempotente: verifica cada recurso antes de crearlo.
# Requiere que el stack Docker esté levantado.
# =============================================================================

$GS_URL  = "http://localhost:8080/geoserver/rest"
$GS_USER = "admin"
$GS_PASS = "geoserver"
$CREDS   = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${GS_USER}:${GS_PASS}"))

$WORKSPACE = "demo"
$DATASTORE = "demo_postgis"
$CAPAS     = @(
    @{ nombre = "inacap_ccp_thno"; titulo = "INACAP Concepcion-Talcahuano" },
    @{ nombre = "eem_idoneos";     titulo = "EEM Idoneos" }
)

function Invoke-GS {
    param(
        [string]$Metodo,
        [string]$Ruta,
        [string]$Cuerpo = $null
    )
    $headers = @{ Authorization = "Basic $CREDS"; Accept = "application/json" }
    $params  = @{ Uri = "$GS_URL$Ruta"; Method = $Metodo; Headers = $headers; ErrorAction = "Stop" }
    if ($Cuerpo) {
        $params.Body        = $Cuerpo
        $params.ContentType = "application/json"
    }
    try {
        $resp = Invoke-RestMethod @params
        return @{ ok = $true; datos = $resp; status = 200 }
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        return @{ ok = $false; datos = $null; status = $status }
    }
}

Write-Host ""
Write-Host "=== GeoServer: publicacion de capas demo ===" -ForegroundColor Cyan
Write-Host "Servidor: $GS_URL"
Write-Host ""

# ── 1. Workspace ──────────────────────────────────────────────────────────────
Write-Host "[ 1/4 ] Verificando workspace '$WORKSPACE'..." -NoNewline
$r = Invoke-GS GET "/workspaces/$WORKSPACE.json"

if ($r.ok) {
    Write-Host " ya existe." -ForegroundColor Green
} else {
    Write-Host " no existe. Creando..." -NoNewline
    $body = '{"workspace":{"name":"' + $WORKSPACE + '"}}'
    $r2   = Invoke-GS POST "/workspaces" $body
    if ($r2.ok -or $r2.status -eq 201) {
        Write-Host " creado." -ForegroundColor Green
    } else {
        Write-Host " ERROR (HTTP $($r2.status))" -ForegroundColor Red
        exit 1
    }
}

# ── 2. Datastore ──────────────────────────────────────────────────────────────
Write-Host "[ 2/4 ] Verificando datastore '$DATASTORE'..." -NoNewline
$r = Invoke-GS GET "/workspaces/$WORKSPACE/datastores/$DATASTORE.json"

if ($r.ok) {
    Write-Host " ya existe." -ForegroundColor Green
} else {
    Write-Host " no existe. Creando..." -NoNewline
    $body = @"
{
  "dataStore": {
    "name": "$DATASTORE",
    "type": "PostGIS",
    "enabled": true,
    "connectionParameters": {
      "entry": [
        {"@key":"host",                "$":"sig_postgres"},
        {"@key":"port",                "$":"5432"},
        {"@key":"database",            "$":"sig_municipal"},
        {"@key":"user",                "$":"sig_usuario"},
        {"@key":"passwd",              "$":"Admin1234"},
        {"@key":"schema",              "$":"mun_demo"},
        {"@key":"dbtype",              "$":"postgis"},
        {"@key":"Expose primary keys", "$":"true"}
      ]
    }
  }
}
"@
    $r2 = Invoke-GS POST "/workspaces/$WORKSPACE/datastores" $body
    if ($r2.ok -or $r2.status -eq 201) {
        Write-Host " creado." -ForegroundColor Green
    } else {
        Write-Host " ERROR (HTTP $($r2.status))" -ForegroundColor Red
        exit 1
    }
}

# ── 3 & 4. Capas ──────────────────────────────────────────────────────────────
$paso = 3
foreach ($capa in $CAPAS) {
    $nombre = $capa.nombre
    $titulo = $capa.titulo

    Write-Host "[ $paso/4 ] Verificando capa '$nombre'..." -NoNewline
    $r = Invoke-GS GET "/workspaces/$WORKSPACE/datastores/$DATASTORE/featuretypes/$nombre.json"

    if ($r.ok) {
        Write-Host " ya publicada." -ForegroundColor Green
    } else {
        Write-Host " no existe. Publicando..." -NoNewline
        $body = @"
{
  "featureType": {
    "name":             "$nombre",
    "nativeName":       "$nombre",
    "title":            "$titulo",
    "nativeCRS":        "EPSG:32718",
    "srs":              "EPSG:4326",
    "projectionPolicy": "REPROJECT_TO_DECLARED",
    "enabled":          true
  }
}
"@
        $r2 = Invoke-GS POST "/workspaces/$WORKSPACE/datastores/$DATASTORE/featuretypes" $body
        if ($r2.ok -or $r2.status -eq 201) {
            Write-Host " publicada." -ForegroundColor Green

            # Recalcular bbox desde los datos reales
            Write-Host "         Recalculando bbox..." -NoNewline
            $bodyPut = '{"featureType":{"name":"' + $nombre + '","enabled":true}}'
            $r3 = Invoke-GS PUT "/workspaces/$WORKSPACE/datastores/$DATASTORE/featuretypes/${nombre}?recalculate=nativebbox,latlonbbox" $bodyPut
            if ($r3.ok -or $r3.status -eq 200) {
                Write-Host " ok." -ForegroundColor Green
            } else {
                Write-Host " advertencia: no se pudo recalcular (HTTP $($r3.status))." -ForegroundColor Yellow
            }
        } else {
            Write-Host " ERROR (HTTP $($r2.status))" -ForegroundColor Red
        }
    }
    $paso++
}

# ── Verificacion final ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== Verificacion final ===" -ForegroundColor Cyan
$r = Invoke-GS GET "/workspaces/$WORKSPACE/datastores/$DATASTORE/featuretypes.json"
if ($r.ok -and $r.datos.featureTypes.featureType) {
    $lista = $r.datos.featureTypes.featureType | ForEach-Object { $_.name }
    Write-Host "Capas publicadas en ${WORKSPACE}/${DATASTORE}:" -ForegroundColor Green
    $lista | ForEach-Object { Write-Host "  - $_" }
} else {
    Write-Host "No se encontraron capas publicadas." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "WMS disponible en: http://localhost:8080/geoserver/$WORKSPACE/wms" -ForegroundColor Cyan
Write-Host ""
