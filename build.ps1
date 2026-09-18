<#
.SYNOPSIS
Builds the OpenCode Web UI, Backend/CLI, and Electron Desktop Application, then creates the Windows installer.

.DESCRIPTION
Runs the build commands across packages/app, packages/opencode, and packages/desktop.
After the desktop build, electron-builder packages the Windows NSIS installer unless SkipPackage is set.

.PARAMETER SkipApp
Skips the Web UI build.

.PARAMETER SkipCli
Skips the OpenCode CLI/Server build.

.PARAMETER SkipDesktop
Skips the Electron desktop build.

.PARAMETER SkipPackage
Skips the Windows installer packaging step.

.PARAMETER SkipInstall
Skips the dependency sync that runs before the builds.

.EXAMPLE
.\build.ps1
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$SkipApp,

    [Parameter()]
    [switch]$SkipCli,

    [Parameter()]
    [switch]$SkipDesktop,

    [Parameter()]
    [switch]$SkipPackage,

    [Parameter()]
    [switch]$SkipInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$script:nativeExitCode = 1

function Invoke-BunScript {
    param(
        [Parameter(Mandatory)]
        [string]$PackageDirectory,

        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    $displayArguments = $Arguments -join " "
    Write-Host "[build] $PackageDirectory> bun $displayArguments"
    Push-Location -LiteralPath $PackageDirectory
    try {
        & bun @Arguments
        $exitCode = $LASTEXITCODE
        $script:nativeExitCode = $exitCode
        if ($exitCode -ne 0) {
            throw "Bun-Befehl ist mit Exitcode $exitCode fehlgeschlagen: bun $displayArguments"
        }
    }
    finally {
        Pop-Location
    }
}

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

    $installedBunVersion = ((& bun --version 2>$null) | Out-String).Trim()

    $packageDirectories = @{
        App = Join-Path $repoRoot "packages\app"
        Cli = Join-Path $repoRoot "packages\opencode"
        Desktop = Join-Path $repoRoot "packages\desktop"
    }

    $mqorvaVersionFile = Join-Path $repoRoot "mqorva-version.json"
    if (-not (Test-Path -LiteralPath $mqorvaVersionFile)) {
        throw "mQorva-Versionsdatei fehlt: $mqorvaVersionFile"
    }

    $mqorva = Get-Content -LiteralPath $mqorvaVersionFile -Raw | ConvertFrom-Json
    foreach ($package in @("packages\app\package.json", "packages\opencode\package.json", "packages\desktop\package.json")) {
        $packageFile = Join-Path $repoRoot $package
        $packageJson = Get-Content -LiteralPath $packageFile -Raw | ConvertFrom-Json
        if ($packageJson.version -ne $mqorva.upstream.version) {
            throw "Versionsabweichung: $package verwendet $($packageJson.version), mqorva-version.json erwartet $($mqorva.upstream.version)."
        }
    }

    Write-Host "[build] Repository: $repoRoot"
    Write-Host "[build] Bun: $installedBunVersion"
    Write-Host ("[build] Edition: OpenCode {0} · mQorva r{1}" -f $mqorva.upstream.version, $mqorva.revision)

    # Builds compile against the installed packages, so node_modules has to match bun.lock first.
    # Without this a stale tree fails deep inside a package build instead of here.
    if (-not $SkipInstall) {
        Invoke-BunScript -PackageDirectory $repoRoot -Arguments @("install", "--frozen-lockfile")
    } else {
        Write-Host "[build] Abhängigkeitsabgleich übersprungen."
    }

    if (-not $SkipApp) {
        Invoke-BunScript -PackageDirectory $packageDirectories.App -Arguments @("run", "build")
    } else {
        Write-Host "[build] App-Build übersprungen."
    }

    if (-not $SkipCli) {
        Invoke-BunScript -PackageDirectory $packageDirectories.Cli -Arguments @("run", "build", "--single", "--skip-install")
    } else {
        Write-Host "[build] OpenCode-Build übersprungen."
    }

    if (-not $SkipDesktop) {
        Invoke-BunScript -PackageDirectory $packageDirectories.Desktop -Arguments @("run", "build")
    } else {
        Write-Host "[build] Desktop-Build übersprungen."
    }

    if (-not $SkipPackage -and -not $SkipDesktop) {
        Invoke-BunScript -PackageDirectory $packageDirectories.Desktop -Arguments @("run", "package:win")

        $distDir = Join-Path $packageDirectories.Desktop "dist"
        Get-ChildItem -LiteralPath $distDir -File -Filter "opencode-mqorva-*.exe" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1 |
            ForEach-Object { Write-Host ("[build] Installer: {0}" -f $_.FullName) }
    } elseif ($SkipPackage) {
        Write-Host "[build] Paketierung übersprungen."
    } else {
        Write-Host "[build] Paketierung übersprungen (Desktop-Build übersprungen)."
    }

    Write-Host "[build] Erfolgreich abgeschlossen!"
    exit 0
}
catch {
    [Console]::Error.WriteLine("[build] Fehlgeschlagen: {0}", $_.Exception.Message)
    $exitCode = if ($script:nativeExitCode -eq 0) { 1 } else { $script:nativeExitCode }
    exit $exitCode
}
