<#!
.SYNOPSIS
    Prüft die Windows-Entwicklungsumgebung und installiert die gesperrten Abhängigkeiten.

.DESCRIPTION
    Das Skript muss nicht aus dem Repository-Root gestartet werden. Es verwendet den
    Speicherort dieses Skripts, prüft die Root-Manifeste und führt anschließend die
    reproduzierbare Bun-Installation aus.

.PARAMETER CacheDirectory
    Optionaler Pfad für den Bun-Installationscache. Relative Pfade werden relativ zum
    aktuellen Arbeitsverzeichnis aufgelöst.

.EXAMPLE
    pwsh -File .\scripts\setup.ps1 -CacheDirectory D:\Cache\opencode-bun
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string] $CacheDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path -Path $PSScriptRoot -ChildPath ".."))
$nativeExitCode = 1
$locationPushed = $false

try {
    if ($PSVersionTable.PSVersion.Major -lt 7) {
        throw "PowerShell 7 oder höher ist erforderlich; gefunden wurde $($PSVersionTable.PSVersion)."
    }

    if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot "package.json") -PathType Leaf) -or
        -not (Test-Path -LiteralPath (Join-Path $repositoryRoot "bun.lock") -PathType Leaf) -or
        -not (Test-Path -LiteralPath (Join-Path $repositoryRoot ".git"))) {
        throw "Der Skriptpfad liegt nicht in einem gültigen OpenCode-Repository-Root: $repositoryRoot"
    }

    $packageJson = Get-Content -LiteralPath (Join-Path $repositoryRoot "package.json") -Raw | ConvertFrom-Json
    if ($packageJson.packageManager -cne "bun@1.3.14") {
        throw "package.json muss exakt packageManager bun@1.3.14 enthalten. Gefunden: $($packageJson.packageManager)"
    }

    $bunCommand = Get-Command bun -CommandType Application -ErrorAction SilentlyContinue
    if ($null -eq $bunCommand) {
        throw "Bun wurde nicht gefunden. Erwartet wird Bun 1.3.14 im PATH."
    }

    $bunVersion = (& bun --version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        $nativeExitCode = $LASTEXITCODE
        throw "Die Bun-Versionsprüfung ist fehlgeschlagen."
    }
    if ($bunVersion -cne "1.3.14") {
        throw "Falsche Bun-Version: $bunVersion. Erwartet wird exakt 1.3.14."
    }

    $nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
    if ($null -eq $nodeCommand) {
        throw "Node.js wurde nicht gefunden. Erwartet wird Node.js 24 im PATH."
    }

    $nodeVersion = (& node --version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        $nativeExitCode = $LASTEXITCODE
        throw "Die Node.js-Versionsprüfung ist fehlgeschlagen."
    }
    if ($nodeVersion -notmatch '^v24(?:\.|$)') {
        throw "Falsche Node.js-Version: $nodeVersion. Erwartet wird Node.js 24."
    }

    $bunArguments = [System.Collections.Generic.List[string]]::new()
    $bunArguments.Add("install")
    $bunArguments.Add("--linker")
    $bunArguments.Add("hoisted")
    $bunArguments.Add("--frozen-lockfile")

    if (-not [string]::IsNullOrWhiteSpace($CacheDirectory)) {
        $cachePath = [IO.Path]::GetFullPath($CacheDirectory)
        if (Test-Path -LiteralPath $cachePath -PathType Leaf) {
            throw "Der Cache-Pfad ist eine Datei und kein Verzeichnis: $cachePath"
        }
        New-Item -ItemType Directory -Path $cachePath -Force | Out-Null
        $bunArguments.Add("--cache-dir")
        $bunArguments.Add($cachePath)
        Write-Host "Bun-Cache: $cachePath"
    }

    Write-Host "Repository-Root: $repositoryRoot"
    Write-Host "Bun 1.3.14 und Node.js 24 erkannt. Installiere Abhängigkeiten ..."
    Push-Location -LiteralPath $repositoryRoot
    $locationPushed = $true
    & bun @bunArguments
    $nativeExitCode = $LASTEXITCODE
    if ($nativeExitCode -ne 0) {
        throw "bun install ist fehlgeschlagen."
    }

    Write-Host "Setup erfolgreich abgeschlossen."
}
catch {
    [Console]::Error.WriteLine("Setup fehlgeschlagen: {0}", $_.Exception.Message)
    exit $nativeExitCode
}
finally {
    if ($locationPushed) {
        Pop-Location
    }
}
