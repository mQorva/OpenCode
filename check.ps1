<#
.SYNOPSIS
Runs package-scoped typechecks and linting across the codebase.

.PARAMETER SkipInstall
Skips the dependency sync that runs before the typechecks.

.EXAMPLE
.\check.ps1
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$SkipInstall
)

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

# Typechecks read the installed packages, so node_modules has to match bun.lock first. An upstream
# merge that moves a dependency otherwise fails here with an error in the package, not the tree.
if (-not $SkipInstall) {
    Write-Host "[check] bun install --frozen-lockfile"
    Push-Location $repoRoot
    try {
        & bun install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) {
            throw "bun install ist fehlgeschlagen. Passen package.json und bun.lock zusammen?"
        }
    }
    finally {
        Pop-Location
    }
}

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
