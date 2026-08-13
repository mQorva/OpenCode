<#
.SYNOPSIS
Builds the Windows baseline in the repository's verified package order.

.DESCRIPTION
Checks the PowerShell, Windows, Bun, package, and package-directory prerequisites,
then runs the build commands from their owning package directories:
packages/app, packages/opencode, and packages/desktop.

The OpenCode single-platform build always receives --skip-install. This keeps a
local Windows build from changing the hoisted dependency resolution through the
build script's optional cross-platform Bun installs.

.PARAMETER SkipApp
Skips the Web UI build.

.PARAMETER SkipCli
Skips the single-platform OpenCode build.

.PARAMETER SkipDesktop
Skips the Electron desktop build.

.EXAMPLE
pwsh -File .\scripts\build.ps1

.EXAMPLE
pwsh -File .\scripts\build.ps1 -SkipApp
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$SkipApp,

    [Parameter()]
    [switch]$SkipCli,

    [Parameter()]
    [switch]$SkipDesktop
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
    if ($PSVersionTable.PSVersion.Major -lt 7) {
        throw "PowerShell 7 oder höher ist erforderlich; gefunden wurde $($PSVersionTable.PSVersion)."
    }

    if (-not $IsWindows) {
        throw "Dieser Basisbuild ist ausschließlich für Windows vorgesehen."
    }

    $bunCommand = Get-Command bun -CommandType Application -ErrorAction SilentlyContinue
    if ($null -eq $bunCommand) {
        throw "Bun wurde nicht gefunden. Installiere die im Repository festgelegte Bun-Version und stelle sie in PATH bereit."
    }

    $repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
    $rootPackagePath = Join-Path $repoRoot "package.json"
    if (-not (Test-Path -LiteralPath $rootPackagePath -PathType Leaf)) {
        throw "Root package.json wurde nicht gefunden: $rootPackagePath"
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

    $packageDirectories = @{
        App = Join-Path $repoRoot "packages\app"
        Cli = Join-Path $repoRoot "packages\opencode"
        Desktop = Join-Path $repoRoot "packages\desktop"
    }
    foreach ($packageDirectory in $packageDirectories.Values) {
        if (-not (Test-Path -LiteralPath $packageDirectory -PathType Container)) {
            throw "Paketverzeichnis wurde nicht gefunden: $packageDirectory"
        }
        if (-not (Test-Path -LiteralPath (Join-Path $packageDirectory "package.json") -PathType Leaf)) {
            throw "package.json fehlt im Paketverzeichnis: $packageDirectory"
        }
    }

    Write-Host "[build] Repository: $repoRoot"
    Write-Host "[build] Bun: $installedBunVersion"
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

    Write-Host "[build] Erfolgreich abgeschlossen."
    exit 0
}
catch {
    [Console]::Error.WriteLine("[build] Fehlgeschlagen: {0}", $_.Exception.Message)
    $exitCode = if ($script:nativeExitCode -eq 0) { 1 } else { $script:nativeExitCode }
    exit $exitCode
}
