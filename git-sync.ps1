<#
.SYNOPSIS
Synchronisiert die OpenCode-mQorva-Edition mit dem eigenen Repository und optional mit OpenCode-Upstream.

.DESCRIPTION
Ohne Parameter werden lokale Änderungen einmal gesammelt committet, `origin/dev` eingebunden und
der fertige Stand zu `origin` gepusht. Mit `-Update` folgt danach der kontrollierte Merge von
`upstream/dev`, einschließlich Versionsdatei, Patch-Markern und Paketprüfungen.

.PARAMETER Update
Holt nach der normalen Origin-Synchronisierung zusätzlich `upstream/dev`, prüft den Merge und pusht
den fertigen Merge-Commit zu `origin/dev`.

.PARAMETER Status
Aktualisiert nur die Remote-Referenzen und zeigt den exakten Ahead/Behind-Stand an.

.PARAMETER SkipCheck
Überspringt beim Upstream-Merge `check.ps1`. `patches.ps1` und `git diff --check` bleiben aktiv.

.PARAMETER NoAutoCommit
Verhindert den Standard-Auto-Commit. Bei lokalen Änderungen wird die Synchronisierung abgebrochen.

.PARAMETER CommitMessage
Optionale Nachricht für den einmaligen Auto-Commit des lokalen Arbeitsstands.

.PARAMETER OriginUrl
URL zum Anlegen von `origin`, falls das Remote noch fehlt.
#>
[CmdletBinding()]
param(
    [Parameter()]
    [switch]$Update,

    [Parameter()]
    [switch]$Status,

    [Parameter()]
    [switch]$SkipCheck,

    [Parameter()]
    [switch]$NoAutoCommit,

    [Parameter()]
    [string]$CommitMessage = "",

    [Parameter()]
    [string]$OriginUrl = "https://github.com/mQorva/OpenCode.git"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$branch = "dev"
$upstreamUrl = "https://github.com/anomalyco/opencode.git"

function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    Write-Host ("git " + ($Arguments -join " "))
    & git -C $repoRoot @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Git-Befehl ist fehlgeschlagen (Exit $LASTEXITCODE): git $($Arguments -join ' ')"
    }
}

function Get-GitOutput {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $value = (& git -C $repoRoot @Arguments 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Git-Abfrage ist fehlgeschlagen (Exit $LASTEXITCODE): git $($Arguments -join ' ')"
    }
    return $value
}

function Test-Remote {
    param([Parameter(Mandatory = $true)][string]$Name)

    & git -C $repoRoot remote get-url $Name 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Initialize-Repository {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "git wurde nicht gefunden."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot ".git"))) {
        throw "Kein Git-Repository unter $repoRoot."
    }

    if (-not (Test-Remote -Name "origin")) {
        Invoke-Git @("remote", "add", "origin", $OriginUrl)
    }
    if (-not (Test-Remote -Name "upstream")) {
        Invoke-Git @("remote", "add", "upstream", $upstreamUrl)
    }

    $current = Get-GitOutput @("branch", "--show-current")
    if ($current -eq $branch) { return }
    if (Test-WorkingTreeChanges) {
        throw "Branch '$current' enthält lokale Änderungen. Vor dem Wechsel zu '$branch' zuerst sichern."
    }
    Invoke-Git @("switch", $branch)
}

function Test-WorkingTreeChanges {
    return -not [string]::IsNullOrWhiteSpace((Get-GitOutput @("status", "--porcelain")))
}

function New-SyncMessage {
    $rows = @(& git -C $repoRoot diff --cached --name-status)
    if (-not $rows) { return "chore: Arbeitsstand synchronisiert" }

    $areas = @(
        $rows |
            ForEach-Object {
                $path = ($_ -split "`t")[-1]
                $segment = ($path -split "/")[0]
                if ($segment -eq $path) { "Repo-Root" } else { $segment }
            } |
            Select-Object -Unique
    )
    $scope = if ($areas.Count -le 3) { $areas -join ", " } else { "$($areas.Count) Bereiche" }
    return "chore: $scope aktualisiert ($($rows.Count) Dateien)"
}

function Save-LocalChanges {
    if (-not (Test-WorkingTreeChanges)) {
        Write-Host "[origin] Keine lokalen Änderungen zu committen." -ForegroundColor DarkGray
        return
    }
    if ($NoAutoCommit) {
        throw "Lokale Änderungen vorhanden und -NoAutoCommit gesetzt."
    }

    Invoke-Git @("add", "-A")
    $message = $CommitMessage.Trim()
    if ([string]::IsNullOrWhiteSpace($message)) {
        $message = New-SyncMessage
    }
    Invoke-Git @("commit", "-m", $message)
}

function Update-RemoteRefs {
    Invoke-Git @("fetch", "origin", $branch)
    Invoke-Git @("fetch", "upstream", $branch, "--tags")
}

function Get-Comparison {
    param([Parameter(Mandatory = $true)][string]$Other)

    $parts = (Get-GitOutput @("rev-list", "--left-right", "--count", "$Other...HEAD")) -split "\s+"
    return [pscustomobject]@{
        RemoteOnly = [int]$parts[0]
        LocalOnly = [int]$parts[1]
    }
}

function Show-SyncStatus {
    $origin = Get-Comparison -Other "origin/$branch"
    $upstream = Get-Comparison -Other "upstream/$branch"
    $head = Get-GitOutput @("rev-parse", "--short=10", "HEAD")
    $upstreamHead = Get-GitOutput @("rev-parse", "--short=10", "upstream/$branch")

    Write-Host ""
    Write-Host "Stand ${branch}: $head" -ForegroundColor Cyan
    Write-Host "origin/${branch}:   $($origin.RemoteOnly) zurück, $($origin.LocalOnly) voraus"
    Write-Host "upstream/${branch}: $($upstream.RemoteOnly) zurück, $($upstream.LocalOnly) Fork-Commits voraus (Upstream $upstreamHead)"
    if ($upstream.RemoteOnly -eq 0) {
        Write-Host "[Status] Alle aktuellen Upstream-Commits sind im Fork enthalten." -ForegroundColor Green
    } else {
        Write-Host "[Status] $($upstream.RemoteOnly) Upstream-Commit(s) fehlen im Fork." -ForegroundColor Yellow
    }
}

function Sync-Origin {
    Save-LocalChanges
    Invoke-Git @("pull", "--no-rebase", "origin", $branch)
    Invoke-Git @("push", "origin", $branch)
}

function Merge-Upstream {
    $comparison = Get-Comparison -Other "upstream/$branch"
    if ($comparison.RemoteOnly -eq 0) {
        Write-Host "[upstream] Bereits aktuell; kein Merge erforderlich." -ForegroundColor Green
        return
    }
    if (Test-WorkingTreeChanges) {
        throw "Der Arbeitsbaum ist vor dem Upstream-Merge nicht sauber."
    }

    $upstreamCommit = Get-GitOutput @("rev-parse", "upstream/$branch")
    $versionFile = Join-Path $repoRoot "mqorva-version.json"
    $upstreamPackage = (Get-GitOutput @("show", "upstream/${branch}:packages/desktop/package.json")) | ConvertFrom-Json
    $mqorva = Get-Content -Raw -LiteralPath $versionFile | ConvertFrom-Json

    & git -C $repoRoot merge "upstream/$branch" --no-ff --no-commit
    if ($LASTEXITCODE -ne 0) {
        throw "Konflikte beim Upstream-Merge. Der Merge bleibt zur manuellen Auflösung geöffnet."
    }

    $mqorva.upstream.commit = $upstreamCommit
    $mqorva.upstream.version = $upstreamPackage.version
    $json = $mqorva | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($versionFile, "$json`n", [System.Text.UTF8Encoding]::new($false))
    Invoke-Git @("add", "--", "mqorva-version.json")

    & (Join-Path $repoRoot "patches.ps1")
    if ($LASTEXITCODE -ne 0) {
        throw "Mindestens eine mQorva-Anpassung fehlt nach dem Upstream-Merge."
    }
    if (-not $SkipCheck) {
        & (Join-Path $repoRoot "check.ps1")
        if ($LASTEXITCODE -ne 0) {
            throw "Die Paketprüfungen nach dem Upstream-Merge sind fehlgeschlagen."
        }
    }
    Invoke-Git @("diff", "--cached", "--check")

    Invoke-Git @("commit", "-m", "chore: sync upstream $($upstreamCommit.Substring(0, 10))")
    Invoke-Git @("push", "origin", $branch)
    Write-Host "[upstream] Merge geprüft und zu origin/$branch gepusht." -ForegroundColor Green
    Write-Host "[Hinweis] Upstream-Kandidaten nach inhaltlichen Fork-Änderungen erneut prüfen." -ForegroundColor Yellow
}

try {
    Initialize-Repository
    Update-RemoteRefs

    if ($Status) {
        Show-SyncStatus
        exit 0
    }

    Sync-Origin
    Update-RemoteRefs
    if ($Update) {
        Merge-Upstream
        Update-RemoteRefs
    }
    Show-SyncStatus
    Write-Host "Fertig." -ForegroundColor Green
}
catch {
    [Console]::Error.WriteLine("[git-sync] Fehlgeschlagen: {0}", $_.Exception.Message)
    exit 1
}
