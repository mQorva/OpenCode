<#
.SYNOPSIS
Prüft, ob die mQorva-Änderungen am OpenCode-Original noch vorhanden sind.

.DESCRIPTION
Nach einem Upstream-Update (sync.ps1) kann ein Merge einzelne Anpassungen verschlucken.
Dieses Skript prüft je Änderung einen Marker-String und meldet, was fehlt.
Die vollständige Beschreibung jeder Änderung steht in plans/upstream-patches.md.

Danach immer check.ps1 laufen lassen — der Typecheck fängt Signaturänderungen ab,
die ein Marker nicht sieht.

.EXAMPLE
.\patches.ps1
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

$patches = @(
    @{ Id = "0a"; File = "mqorva-version.json"; Marker = '"edition": "mQorva"'; What = "mQorva-Versionsmetadaten" }
    @{ Id = "0b"; File = "packages/desktop/electron.vite.config.ts"; Marker = "VITE_MQORVA_DISPLAY_VERSION"; What = "mQorva-Buildmetadaten" }
    @{ Id = "0c"; File = "packages/desktop/electron-builder.config.ts"; Marker = "opencode-mqorva"; What = "mQorva-Paketname" }
    @{ Id = "0d"; File = "packages/desktop/identity.ts"; Marker = "de.mqorva.opencode.desktop"; What = "eigene mQorva-App-IDs" }
    @{ Id = "0e"; File = "packages/desktop/identity.ts"; Marker = 'MQORVA_PROTOCOL = "opencode-mqorva"'; What = "eigenes mQorva-Protokoll" }
    @{ Id = "0f"; File = "packages/desktop/src/main/mqorva-migration.ts"; Marker = ".mqorva-migrated"; What = "einmalige Profilübernahme" }
    @{ Id = "0g"; File = "packages/desktop/src/main/constants.ts"; Marker = "UPDATER_ENABLED = false"; What = "offizieller Updater deaktiviert" }
    @{ Id = "1a"; File = "packages/app/src/context/settings.tsx"; Marker = "resolveLayoutMode"; What = "Typ LayoutMode + Auflösung" }
    @{ Id = "1b"; File = "packages/app/src/context/settings.tsx"; Marker = "layoutMode?: LayoutMode"; What = "Feld in Settings.general" }
    @{ Id = "1d"; File = "packages/app/src/context/settings.tsx"; Marker = "setLayoutMode"; What = "Accessor im Provider" }
    @{ Id = "2";  File = "packages/app/src/components/settings-v2/general.tsx"; Marker = "settings-sidebar-layout"; What = "Schalter in den Einstellungen" }
    @{ Id = "3a"; File = "packages/app/src/components/titlebar.tsx"; Marker = "sessionTabs?: boolean"; What = "Sitzungs-Tab-Option an der Titlebar" }
    @{ Id = "3b"; File = "packages/app/src/components/titlebar.tsx"; Marker = "props.sessionTabs !== false"; What = "Sitzungs-Tabs ausblendbar" }
    @{ Id = "3c"; File = "packages/app/src/components/windows-app-menu.tsx"; Marker = "desktop-app-menu-bar"; What = "verteiltes Windows-App-Menü" }
    @{ Id = "4a"; File = "packages/app/src/app.tsx"; Marker = "layout-sidebar/shell"; What = "Import des Seitenleisten-Layouts" }
    @{ Id = "4b"; File = "packages/app/src/app.tsx"; Marker = 'layoutMode() === "sidebar"'; What = "Layout-Weiche in NewAppLayout" }
    @{ Id = "4c"; File = "packages/app/src/app.tsx"; Marker = "SidebarAwareHome"; What = "Startseiten-Weiche" }
    @{ Id = "5";  File = "packages/app/src/context/layout.tsx"; Marker = "toggleReviewPanel"; What = "key-freier Panel-Zugang" }
    @{ Id = "6a"; File = "packages/app/src/i18n/en.ts"; Marker = "sidebarLayout.title"; What = "Beschriftungen (en)" }
    @{ Id = "6b"; File = "packages/app/src/i18n/de.ts"; Marker = "sidebarLayout.title"; What = "Beschriftungen (de)" }
    @{ Id = "7"; File = "packages/app/src/components/directory-picker.tsx"; Marker = "preferInternal?: boolean"; What = "nativer Desktop-Verzeichnisdialog" }
    @{ Id = "7b"; File = "packages/app/src/pages/home/home-controller.ts"; Marker = "const registrations = directories.map"; What = "abwartbare OpenCode-Projektregistrierung" }
    @{ Id = "8"; File = "packages/app/src/components/session/session-header.tsx"; Marker = "sidebarLayout = createMemo"; What = "mQorva-Sitzungskopf" }
    @{ Id = "9a"; File = "packages/app/src/pages/new-session.tsx"; Marker = 'id="draft-workspace-panel"'; What = "Panels im neuen Chat" }
    @{ Id = "9b"; File = "packages/app/src/pages/new-session/new-session-view.tsx"; Marker = "const sidebarLayout = () =>"; What = "Composer im Seitenleisten-Layout" }
    @{ Id = "10a"; File = "packages/app/src/pages/session.tsx"; Marker = "const sidebarLayout = createMemo"; What = "Sitzungscontainer der mQorva-Shell" }
    @{ Id = "10b"; File = "packages/app/src/pages/session/session-side-panel.tsx"; Marker = 'layoutMode() !== "sidebar"'; What = "rechter Sitzungsbereich" }
    @{ Id = "11"; File = "packages/app/src/context/platform.tsx"; Marker = "displayVersion: string"; What = "zusätzliche Editionsmetadaten" }
    @{ Id = "12a"; File = "packages/app/src/components/settings-v2/dialog-settings-v2.tsx"; Marker = "platform.edition.name"; What = "mQorva-Version in Einstellungen (v2)" }
    @{ Id = "12b"; File = "packages/app/src/components/dialog-settings.tsx"; Marker = "platform.edition.name"; What = "mQorva-Version in Einstellungen" }
)

Write-Host "[patches] Prüfe mQorva-Änderungen am OpenCode-Original ..."

$missing = @()
foreach ($patch in $patches) {
    $path = Join-Path $repoRoot $patch.File
    if (-not (Test-Path -LiteralPath $path)) {
        $missing += $patch
        Write-Host ("[patches] FEHLT  {0}  Datei nicht gefunden: {1}" -f $patch.Id, $patch.File) -ForegroundColor Red
        continue
    }

    $content = Get-Content -LiteralPath $path -Raw
    if ($content.Contains($patch.Marker)) {
        Write-Host ("[patches] ok     {0}  {1}" -f $patch.Id, $patch.What) -ForegroundColor DarkGray
    } else {
        $missing += $patch
        Write-Host ("[patches] FEHLT  {0}  {1}  ({2})" -f $patch.Id, $patch.What, $patch.File) -ForegroundColor Red
    }
}

# Die eigenen Dateien liegen außerhalb des Upstream-Codes und können nicht kollidieren,
# aber ein verunglückter Merge kann sie löschen.
$owned = "packages/app/src/pages/layout-sidebar"
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $owned))) {
    Write-Host ("[patches] FEHLT  ---  eigener Layout-Ordner: {0}" -f $owned) -ForegroundColor Red
    $missing += @{ Id = "---" }
}

Write-Host ""
if ($missing.Count -eq 0) {
    Write-Host "[patches] Alle Änderungen vorhanden. Jetzt check.ps1 ausführen." -ForegroundColor Green
    exit 0
}

Write-Host ("[patches] {0} Änderung(en) fehlen — Beschreibung in plans/upstream-patches.md" -f $missing.Count) -ForegroundColor Red
exit 1
