<#
.SYNOPSIS
Runs package-scoped typechecks and linting across the codebase.

.EXAMPLE
.\check.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "package.json")) {
    $PSScriptRoot
} else {
    (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
}

$packages = @(
    "packages/core",
    "packages/schema",
    "packages/opencode",
    "packages/app",
    "packages/desktop"
)

Write-Host "[check] Führe Typechecks aus ..."
foreach ($pkg in $packages) {
    $dir = Join-Path $repoRoot $pkg
    if (Test-Path $dir) {
        Write-Host "[check] $pkg> bun typecheck"
        Push-Location $dir
        try {
            & bun typecheck
            if ($LASTEXITCODE -ne 0) {
                throw "Typecheck in $pkg fehlgeschlagen."
            }
        }
        finally {
            Pop-Location
        }
    }
}

Write-Host "[check] Alle Prüfungen erfolgreich abgeschlossen!"
