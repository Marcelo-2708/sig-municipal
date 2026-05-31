# =============================================================================
# publicar_estilos_vichuquen.ps1
# Publica los estilos SLD de Vichuquen en GeoServer y los asocia a cada capa.
#
# Requisitos:
#   - Stack Docker corriendo (docker compose up -d)
#   - Los 4 archivos .sld en la misma carpeta que este script
#   - PowerShell 5.1+ en Windows
#
# Uso:
#   .\publicar_estilos_vichuquen.ps1
#
# Si GeoServer cambio credenciales, editar $gs_user / $gs_pass abajo.
# =============================================================================

$ErrorActionPreference = "Stop"

# --- Configuracion ---
$gs_url    = "http://localhost:8080/geoserver"
$gs_user   = "admin"
$gs_pass   = "geoserver"
$workspace = "vichuquen"

# Carpeta de estilos: misma carpeta que el script
$script_dir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Tabla: nombre_estilo, archivo_sld, nombre_capa
$estilos = @(
    @{ nombre = "vichuquen_censo_style";    archivo = "vichuquen_censo_style.sld";    capa = "censo"    },
    @{ nombre = "vichuquen_red_vial_style"; archivo = "vichuquen_red_vial_style.sld"; capa = "red_vial" },
    @{ nombre = "vichuquen_amenaza_style";  archivo = "vichuquen_amenaza_style.sld";  capa = "amenaza"  },
    @{ nombre = "vichuquen_hogares_style";  archivo = "vichuquen_hogares_style.sld";  capa = "hogares"  }
)

# Credenciales para Invoke-RestMethod
$cred = New-Object System.Management.Automation.PSCredential(
    $gs_user,
    (ConvertTo-SecureString $gs_pass -AsPlainText -Force)
)

# --- Helpers usando splatting (compatible PS 5.1, evita problemas de backtick) ---

function GS-Get {
    param($url)
    $max = 3
    for ($i = 1; $i -le $max; $i++) {
        try {
            $p = @{
                Uri         = $url
                Method      = "GET"
                Credential  = $cred
                ContentType = "application/json"
                ErrorAction = "Stop"
            }
            return Invoke-RestMethod @p
        } catch {
            if ($i -eq $max) { throw }
            Start-Sleep -Seconds 2
        }
    }
}

function GS-Post {
    param($url, $body, $ct)
    $max = 3
    for ($i = 1; $i -le $max; $i++) {
        try {
            $p = @{
                Uri         = $url
                Method      = "POST"
                Credential  = $cred
                ContentType = $ct
                Body        = $body
                ErrorAction = "Stop"
            }
            return Invoke-RestMethod @p
        } catch {
            if ($i -eq $max) { throw }
            Start-Sleep -Seconds 2
        }
    }
}

function GS-Put {
    param($url, $body, $ct)
    $max = 3
    for ($i = 1; $i -le $max; $i++) {
        try {
            $p = @{
                Uri         = $url
                Method      = "PUT"
                Credential  = $cred
                ContentType = $ct
                Body        = $body
                ErrorAction = "Stop"
            }
            return Invoke-RestMethod @p
        } catch {
            if ($i -eq $max) { throw }
            Start-Sleep -Seconds 2
        }
    }
}

# ---------------------------------------------------------------------------

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Publicando estilos SLD - workspace: $workspace" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

foreach ($e in $estilos) {
    $sld_path = Join-Path $script_dir $e.archivo

    if (-not (Test-Path $sld_path)) {
        Write-Warning "Archivo no encontrado: $sld_path - omitiendo $($e.nombre)"
        continue
    }

    Write-Host "--- Estilo: $($e.nombre) ---" -ForegroundColor Yellow

    # Leer contenido SLD en UTF-8
    $sld_content = Get-Content $sld_path -Raw -Encoding UTF8

    # Verificar si el estilo ya existe en el workspace
    $existe = $false
    try {
        GS-Get "$gs_url/rest/workspaces/$workspace/styles/$($e.nombre).json" | Out-Null
        $existe = $true
    } catch { }

    if ($existe) {
        Write-Host "  Estilo ya existe -> actualizando (PUT)..."
        GS-Put "$gs_url/rest/workspaces/$workspace/styles/$($e.nombre)" $sld_content "application/vnd.ogc.sld+xml"
        Write-Host "  Actualizado OK" -ForegroundColor Green
    } else {
        Write-Host "  Estilo nuevo -> creando (POST)..."
        $meta = '{"style":{"name":"' + $e.nombre + '","filename":"' + $e.archivo + '"}}'
        GS-Post "$gs_url/rest/workspaces/$workspace/styles" $meta "application/json"
        GS-Put "$gs_url/rest/workspaces/$workspace/styles/$($e.nombre)" $sld_content "application/vnd.ogc.sld+xml"
        Write-Host "  Creado OK" -ForegroundColor Green
    }

    # Asociar estilo como default de la capa
    Write-Host "  Asociando a capa $($e.capa)..."
    $layer_body = '{"layer":{"defaultStyle":{"name":"' + $e.nombre + '","workspace":"' + $workspace + '"}}}'
    GS-Put "$gs_url/rest/layers/${workspace}:$($e.capa)" $layer_body "application/json"
    Write-Host "  Asociado OK" -ForegroundColor Green
    Write-Host ""
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Todos los estilos publicados." -ForegroundColor Green
Write-Host ""
Write-Host "  Verificar en:" -ForegroundColor White
Write-Host "  http://localhost:8080/geoserver/web/#/styles" -ForegroundColor White
Write-Host ""
Write-Host "  AVISO: capa amenaza usa gridcode (1=Baja, 2=Media)." -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Cyan
