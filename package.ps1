<#
.SYNOPSIS
Builds and packages the OpenCode – mQorva Edition Windows desktop distribution.

.DESCRIPTION
Runs a fresh build, packages the Electron app with electron-builder, and creates the NSIS installer.

.PARAMETER SkipBuild
Packages an existing desktop output without rebuilding. Use only when the same source state was built immediately before.

.EXAMPLE
.\package.ps1
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$nativeExitCode = 1

try {
    $bunCommand = Get-Command bun -CommandType Application -ErrorAction SilentlyContinue
    if ($null -eq $bunCommand) {
        throw "Bun wurde nicht gefunden. Stelle sicher, dass Bun im PATH verfügbar ist."
    }

    $repoRoot = if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "package.json")) {
        $PSScriptRoot
    } else {
        (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    }

    $desktopDirectory = Join-Path $repoRoot "packages\desktop"
    $desktopBuildSentinel = Join-Path $desktopDirectory "out\main\index.js"
    $buildScript = Join-Path $repoRoot "build.ps1"

    if (-not $SkipBuild) {
        Write-Host "[package] Erzeuge einen frischen vollständigen Build ..."
        & $buildScript
        if ($LASTEXITCODE -ne 0) {
            throw "Der vorbereitende Build ist fehlgeschlagen."
        }
    }

    if (-not (Test-Path -LiteralPath $desktopBuildSentinel)) {
        throw "Desktop-Build fehlt: $desktopBuildSentinel"
    }

    if ($SkipBuild) {
        Write-Host "[package] WARNUNG: Vorhandener Build wird ohne Aktualitätsprüfung paketiert." -ForegroundColor Yellow
    }

    Write-Host "[package] Starte Windows-Paketierung in $desktopDirectory ..."
    Push-Location -LiteralPath $desktopDirectory
    try {
        & bun run package:win
        $nativeExitCode = $LASTEXITCODE
        if ($nativeExitCode -ne 0) {
            throw "electron-builder ist mit Exitcode $nativeExitCode fehlgeschlagen."
        }
    }
    finally {
        Pop-Location
    }

    $distDir = Join-Path $desktopDirectory "dist"
    Write-Host "[package] Paketierung erfolgreich!"
    Write-Host "[package] Ausgabeverzeichnis: $distDir"
    Get-ChildItem -LiteralPath $distDir -File -Filter "opencode-mqorva-*.exe" |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1 |
        ForEach-Object { Write-Host ("[package] Installer: {0}" -f $_.FullName) }
    exit 0
}
catch {
    [Console]::Error.WriteLine("[package] Fehlgeschlagen: {0}", $_.Exception.Message)
    exit $nativeExitCode
}
