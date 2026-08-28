<#
.SYNOPSIS
Verwaltet die Git-Synchronisation der OpenCode - mQorva Edition.

.DESCRIPTION
Ermoeglicht gezieltes Updaten von OpenCode, separates Sichern auf dein GitHub oder Statusabfragen.

.PARAMETER Update
Holt die neuesten Updates aus dem offiziellen OpenCode-Repository (upstream).
Verweigert die Ausfuehrung bei ungesicherten lokalen Anpassungen.

.PARAMETER Backup
Sichert den lokalen Stand auf dein persoenliches GitHub-Repository (origin).
Pusht nur einen bereits sauber committeten Stand.

.PARAMETER Status
Zeigt den aktuellen Status und Unterschiede (ahead/behind) an, ohne Aenderungen durchzufuehren.

.PARAMETER SkipCheck
Ueberspringt nach einem Upstream-Update die paketbezogenen Typechecks. Die Markerpruefung bleibt aktiv.

.PARAMETER OriginUrl
Setzt oder aktualisiert die URL deines eigenen GitHub-Repositories (origin).

.PARAMETER Message
Veralteter Kompatibilitaetsparameter. Der Upstream-Sync erstellt keine Sammelcommits mehr.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$Update,

    [Parameter()]
    [switch]$Backup,

    [Parameter()]
    [switch]$Status,

    [Parameter()]
    [switch]$SkipCheck,

    [Parameter()]
    [string]$OriginUrl,

    [Parameter()]
    [string]$Message
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "package.json")) {
    $PSScriptRoot
} else {
    (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
}

Push-Location -LiteralPath $repoRoot
try {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  OpenCode - mQorva Edition" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan

    # 1. Upstream-Remote sicherstellen
    $upstreamUrl = "https://github.com/anomalyco/opencode.git"
    $existingRemotes = git remote
    if ($existingRemotes -notcontains "upstream") {
        Write-Host "[git] Richte Upstream-Remote ein ($upstreamUrl) ..." -ForegroundColor Yellow
        git remote add upstream $upstreamUrl
    }

    # 2. Origin-Remote setzen wenn uebergeben
    if (-not [string]::IsNullOrWhiteSpace($OriginUrl)) {
        if ($existingRemotes -contains "origin") {
            Write-Host "[git] Aktualisiere Origin-URL auf: $OriginUrl" -ForegroundColor Yellow
            git remote set-url origin $OriginUrl
        } else {
            Write-Host "[git] Fuege Origin-Remote hinzu: $OriginUrl" -ForegroundColor Yellow
            git remote add origin $OriginUrl
        }
    }

    $currentBranch = (git branch --show-current).Trim()
    if ([string]::IsNullOrWhiteSpace($currentBranch)) {
        $currentBranch = "dev"
    }

    Write-Host ""
    Write-Host "[Status] Lokaler Branch: $currentBranch" -ForegroundColor Green
    $versionFile = Join-Path $repoRoot "mqorva-version.json"
    if (-not (Test-Path -LiteralPath $versionFile)) {
        throw "Versionsdatei fehlt: $versionFile"
    }

    $mqorva = Get-Content -LiteralPath $versionFile -Raw | ConvertFrom-Json
    Write-Host ("[Status] Edition: OpenCode {0} . mQorva r{1}" -f $mqorva.upstream.version, $mqorva.revision) -ForegroundColor Green
    Write-Host ("[Status] Dokumentierter Upstream: {0}" -f $mqorva.upstream.commit)
    Write-Host "[Status] Remotes:"
    git remote -v

    $workingTree = (git status --porcelain | Out-String).Trim()
    if ($workingTree) {
        Write-Host "[Status] Arbeitsverzeichnis enthaelt nicht committete Aenderungen." -ForegroundColor Yellow
    } else {
        Write-Host "[Status] Arbeitsverzeichnis ist sauber." -ForegroundColor DarkGray
    }

    # Wenn kein Parameter angegeben wurde, Status anzeigen und Hilfe ausgeben
    if (-not $Update -and -not $Backup) {
        Write-Host ""
        Write-Host "Aktionen:" -ForegroundColor Yellow
        Write-Host "  .\Sync-Upstream.ps1 -Update   --> Holt offizielle OpenCode-Updates (upstream -> lokal)"
        Write-Host "  .\Sync-Upstream.ps1 -Backup   --> Pusht den sauber committeten Stand zu origin"
        Write-Host "  .\Sync-Upstream.ps1 -Status   --> Zeigt aktuellen Stand an"

        $hasOrigin = (git remote) -contains "origin"
        if (-not $hasOrigin) {
            Write-Host ""
            Write-Host "[HINWEIS] Es ist noch kein 'origin' (dein GitHub) hinterlegt." -ForegroundColor Yellow
            Write-Host "  Setzen mit: .\Sync-Upstream.ps1 -OriginUrl 'https://github.com/DEIN_NAME/opencode.git'" -ForegroundColor Cyan
        }
        return
    }

    # Aktion 1: Update von OpenCode
    if ($Update) {
        Write-Host ""
        if ($workingTree) {
            throw "Das Arbeitsverzeichnis ist nicht sauber. Teile und committe die Aenderungen fachlich, bevor du Upstream mergst."
        }

        Write-Host "[UPDATE] Hole die neuesten Aenderungen aus dem offiziellen OpenCode-Repository ..." -ForegroundColor Magenta
        git fetch upstream dev --tags
        if ($LASTEXITCODE -ne 0) {
            throw "Abruf von upstream/dev ist fehlgeschlagen."
        }

        $upstreamCommit = (git rev-parse upstream/dev).Trim()
        git merge-base --is-ancestor upstream/dev HEAD
        $upstreamIncluded = $LASTEXITCODE -eq 0
        if ($upstreamIncluded) {
            Write-Host "[UPDATE] Die dokumentierte OpenCode-Basis ist bereits aktuell." -ForegroundColor DarkGray
        } else {
            $upstreamPackage = (git show "upstream/dev:packages/desktop/package.json" | Out-String) | ConvertFrom-Json
            git merge upstream/dev --no-ff --no-commit
            if ($LASTEXITCODE -ne 0) {
                throw "Konflikte beim Zusammenfuehren. Der Merge bleibt zur manuellen Aufloesung geoeffnet."
            }

            $mqorva.upstream.commit = $upstreamCommit
            $mqorva.upstream.version = $upstreamPackage.version
            $json = $mqorva | ConvertTo-Json -Depth 10
            [System.IO.File]::WriteAllText($versionFile, "$json`n", [System.Text.UTF8Encoding]::new($false))
            git add -- mqorva-version.json
            Write-Host "[UPDATE] mqorva-version.json auf die neue OpenCode-Basis aktualisiert." -ForegroundColor Yellow

            Write-Host "[UPDATE] Pruefe die technischen mQorva-Marker ..." -ForegroundColor Magenta
            & (Join-Path $repoRoot "patches.ps1")
            if ($LASTEXITCODE -ne 0) {
                throw "Mindestens eine mQorva-Anpassung fehlt nach dem Upstream-Merge."
            }

            if (-not $SkipCheck) {
                Write-Host "[UPDATE] Fuehre die paketbezogenen Typechecks aus ..." -ForegroundColor Magenta
                & (Join-Path $repoRoot "check.ps1")
                if ($LASTEXITCODE -ne 0) {
                    throw "Die Pruefungen nach dem Upstream-Merge sind fehlgeschlagen."
                }
            }

            $shortCommit = $upstreamCommit.Substring(0, 10)
            git commit -m "chore: sync upstream $shortCommit"
            if ($LASTEXITCODE -ne 0) {
                throw "Der gepruefte Upstream-Merge konnte nicht committet werden."
            }

            Write-Host "[OK] OpenCode-Basis erfolgreich aktualisiert, geprueft und dokumentiert." -ForegroundColor Green
        }
    }

    # Aktion 2: Backup auf eigenes GitHub (origin)
    if ($Backup) {
        Write-Host ""
        $hasOrigin = (git remote) -contains "origin"
        if (-not $hasOrigin) {
            Write-Host "[FEHLER] Kein 'origin'-Remote vorhanden. Bitte hinterlege zuerst dein GitHub-Repository:" -ForegroundColor Red
            Write-Host "  .\sync.ps1 -OriginUrl 'https://github.com/DEIN_NAME/opencode.git'" -ForegroundColor Cyan
            return
        }

        if ($workingTree) {
            throw "Das Arbeitsverzeichnis ist nicht sauber. -Backup pusht keine automatisch erzeugten Sammelcommits mehr."
        }

        Write-Host "[BACKUP] Sichere lokalen Stand auf dein GitHub-Repository (origin) ..." -ForegroundColor Magenta
        git push origin $currentBranch --tags
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Erfolgreich auf dein GitHub-Repository gesichert!" -ForegroundColor Green
        }
    }

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "  Fertig." -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
}
catch {
    [Console]::Error.WriteLine("[sync] Fehlgeschlagen: {0}", $_.Exception.Message)
    exit 1
}
finally {
    Pop-Location
}
