<#
.SYNOPSIS
    Prüft die Windows-Entwicklungsumgebung und installiert die gesperrten Abhängigkeiten.

.DESCRIPTION
    Kann direkt aus dem Repository-Root oder einem beliebigen Verzeichnis gestartet werden.

.PARAMETER CacheDirectory
    Optionaler Pfad für den Bun-Installationscache.

.EXAMPLE
    .\setup.ps1
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string] $CacheDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "package.json")) {
    $PSScriptRoot
} else {
    [IO.Path]::GetFullPath((Join-Path -Path $PSScriptRoot -ChildPath ".."))
}
$nativeExitCode = 1
$locationPushed = $false

try {
    if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot "package.json") -PathType Leaf) -or
        -not (Test-Path -LiteralPath (Join-Path $repositoryRoot "bun.lock") -PathType Leaf)) {
        throw "Gültiges OpenCode-Repository nicht gefunden in: $repositoryRoot"
    }

    $bunCommand = Get-Command bun -CommandType Application -ErrorAction SilentlyContinue
    if ($null -eq $bunCommand) {
        throw "Bun wurde nicht gefunden. Erwartet wird Bun im PATH."
    }

    $bunVersion = (& bun --version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        $nativeExitCode = $LASTEXITCODE
        throw "Die Bun-Versionsprüfung ist fehlgeschlagen."
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
    Write-Host "Bun $bunVersion erkannt. Installiere Abhängigkeiten ..."
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
