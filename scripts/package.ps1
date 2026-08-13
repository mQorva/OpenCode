<#
.SYNOPSIS
Builds and packages the verified Windows desktop distribution.

.DESCRIPTION
Checks the existing Electron desktop build, optionally creates it through
scripts/build.ps1, runs the package:win script from packages/desktop, and verifies
the NSIS installer, its blockmap, and an executable in win-unpacked.

The script does not publish or configure signing. It only invokes the repository's
existing package:win script and reports the resulting local artifact paths.

.PARAMETER BuildIfMissing
Runs scripts/build.ps1 when the desktop build sentinel is missing. Without this
switch, packaging stops with a clear prerequisite error.

.EXAMPLE
pwsh -File .\scripts\package.ps1

.EXAMPLE
pwsh -File .\scripts\package.ps1 -BuildIfMissing
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$BuildIfMissing
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$nativeExitCode = 1

try {
    if ($PSVersionTable.PSVersion.Major -lt 7) {
        throw "PowerShell 7 oder höher ist erforderlich; gefunden wurde $($PSVersionTable.PSVersion)."
    }

    if (-not $IsWindows) {
        throw "Die Windows-Paketierung ist ausschließlich für Windows vorgesehen."
    }

    $bunCommand = Get-Command bun -CommandType Application -ErrorAction SilentlyContinue
    if ($null -eq $bunCommand) {
        throw "Bun wurde nicht gefunden. Installiere die im Repository festgelegte Bun-Version und stelle sie in PATH bereit."
    }

    $repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    $rootPackagePath = Join-Path $repoRoot "package.json"
    $desktopDirectory = Join-Path $repoRoot "packages\desktop"
    $desktopPackagePath = Join-Path $desktopDirectory "package.json"
    $desktopBuildSentinel = Join-Path $desktopDirectory "out\main\index.js"
    $packageOutputDirectory = Join-Path $desktopDirectory "dist"
    $buildScript = Join-Path $repoRoot "scripts\build.ps1"

    foreach ($requiredPath in @($rootPackagePath, $desktopDirectory, $desktopPackagePath)) {
        if (-not (Test-Path -LiteralPath $requiredPath)) {
            throw "Erforderlicher Desktop-Pfad wurde nicht gefunden: $requiredPath"
        }
    }

    $rootPackage = Get-Content -LiteralPath $rootPackagePath -Raw | ConvertFrom-Json
    $packageManager = [string]$rootPackage.packageManager
    if ($packageManager -notmatch '^bun@(?<version>[^\s]+)$') {
        throw "package.json enthält keine auswertbare Bun-Version in packageManager."
    }
    $requiredBunVersion = $Matches.version
    $installedBunVersion = ((& bun --version 2>$null) | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $installedBunVersion -ne $requiredBunVersion) {
        throw "Falsche Bun-Version: erwartet $requiredBunVersion, gefunden $installedBunVersion."
    }
    Write-Host "[package] Bun: $installedBunVersion"

    if (-not (Test-Path -LiteralPath $desktopBuildSentinel -PathType Leaf)) {
        if (-not $BuildIfMissing) {
            throw "Der Desktop-Build fehlt. Erwartet: $desktopBuildSentinel. Verwende -BuildIfMissing für einen kontrollierten Basisbuild."
        }
        if (-not (Test-Path -LiteralPath $buildScript -PathType Leaf)) {
            throw "Das Build-Skript wurde nicht gefunden: $buildScript"
        }

        Write-Host "[package] Desktop-Build fehlt; starte scripts/build.ps1."
        & pwsh -NoProfile -File $buildScript
        $nativeExitCode = $LASTEXITCODE
        if ($nativeExitCode -ne 0) {
            throw "Der kontrollierte Basisbuild ist mit Exitcode $nativeExitCode fehlgeschlagen."
        }
    }

    if (-not (Test-Path -LiteralPath $desktopBuildSentinel -PathType Leaf)) {
        throw "Der Desktop-Build ist nach der Prüfung weiterhin unvollständig: $desktopBuildSentinel"
    }

    Push-Location -LiteralPath $desktopDirectory
    try {
        Write-Host "[package] $desktopDirectory> bun run package:win"
        & bun run package:win
        $exitCode = $LASTEXITCODE
        $nativeExitCode = $exitCode
        if ($exitCode -ne 0) {
            throw "Windows-Paketierung ist mit Exitcode $exitCode fehlgeschlagen."
        }
    }
    finally {
        Pop-Location
    }

    $resolvedOutputDirectory = (Resolve-Path -LiteralPath $packageOutputDirectory).Path
    $installer = Get-ChildItem -LiteralPath $resolvedOutputDirectory -File -Filter "opencode-desktop-*.exe" |
        Where-Object { $_.Directory.FullName -eq $resolvedOutputDirectory -and -not $_.Name.EndsWith(".__uninstaller.exe") } |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
    if ($null -eq $installer) {
        throw "Kein Windows-Installer im Ausgabeordner gefunden: $packageOutputDirectory"
    }

    $blockmapPath = "$($installer.FullName).blockmap"
    if (-not (Test-Path -LiteralPath $blockmapPath -PathType Leaf)) {
        throw "Die zum Installer gehörende Blockmap fehlt: $blockmapPath"
    }

    $unpackedDirectory = Join-Path $resolvedOutputDirectory "win-unpacked"
    $unpackedExecutable = Get-ChildItem -LiteralPath $unpackedDirectory -File -Filter "*.exe" |
        Select-Object -First 1
    if ($null -eq $unpackedExecutable) {
        throw "Keine ausführbare Datei in win-unpacked gefunden: $unpackedDirectory"
    }

    Write-Host "[package] Installer: $($installer.FullName)"
    Write-Host "[package] Blockmap: $blockmapPath"
    Write-Host "[package] Entpackte Anwendung: $($unpackedExecutable.FullName)"
    Write-Host "[package] Erfolgreich abgeschlossen; keine Veröffentlichung ausgeführt."
    exit 0
}
catch {
    [Console]::Error.WriteLine("[package] Fehlgeschlagen: {0}", $_.Exception.Message)
    $exitCode = if ($nativeExitCode -eq 0) { 1 } else { $nativeExitCode }
    exit $exitCode
}
