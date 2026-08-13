<#!
.SYNOPSIS
    Prüft den Arbeitsbaum und die drei relevanten Typecheck-Pakete nacheinander.

.DESCRIPTION
    Das Skript arbeitet unabhängig vom aktuellen Arbeitsverzeichnis. Es führt bewusst
    keinen Root-Test und keine Paket- oder Installationsänderung aus.

.EXAMPLE
    pwsh -File .\scripts\check.ps1
#>
[CmdletBinding()]
param()

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

    if ($null -eq (Get-Command git -CommandType Application -ErrorAction SilentlyContinue)) {
        throw "Git wurde nicht gefunden."
    }
    if ($null -eq (Get-Command bun -CommandType Application -ErrorAction SilentlyContinue)) {
        throw "Bun wurde nicht gefunden."
    }

    Write-Host "Repository-Root: $repositoryRoot"
    Push-Location -LiteralPath $repositoryRoot
    $locationPushed = $true

    Write-Host "Prüfe Git-Whitespace ..."
    & git diff --check
    $nativeExitCode = $LASTEXITCODE
    if ($nativeExitCode -ne 0) {
        throw "git diff --check ist fehlgeschlagen."
    }

    @("packages/opencode", "packages/app", "packages/desktop") | ForEach-Object {
        $packagePath = Join-Path $repositoryRoot $_
        if (-not (Test-Path -LiteralPath (Join-Path $packagePath "package.json") -PathType Leaf)) {
            throw "Paketmanifest nicht gefunden: $packagePath"
        }

        Write-Host "Typecheck: $_"
        Push-Location -LiteralPath $packagePath
        try {
            & bun typecheck
            $nativeExitCode = $LASTEXITCODE
        }
        finally {
            Pop-Location
        }
        if ($nativeExitCode -ne 0) {
            throw "bun typecheck ist in $_ fehlgeschlagen."
        }
    }

    Write-Host "Check erfolgreich abgeschlossen."
}
catch {
    [Console]::Error.WriteLine("Check fehlgeschlagen: {0}", $_.Exception.Message)
    exit $nativeExitCode
}
finally {
    if ($locationPushed) {
        Pop-Location
    }
}
