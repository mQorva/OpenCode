<#
.SYNOPSIS
Builds the OpenCode Web UI, Backend/CLI, and Electron Desktop Application.

.DESCRIPTION
Runs the build commands across packages/app, packages/opencode, and packages/desktop.

.PARAMETER SkipApp
Skips the Web UI build.

.PARAMETER SkipCli
Skips the OpenCode CLI/Server build.

.PARAMETER SkipDesktop
Skips the Electron desktop build.

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

    Write-Host "[build] Erfolgreich abgeschlossen!"
    exit 0
}
catch {
    [Console]::Error.WriteLine("[build] Fehlgeschlagen: {0}", $_.Exception.Message)
    $exitCode = if ($script:nativeExitCode -eq 0) { 1 } else { $script:nativeExitCode }
    exit $exitCode
}
