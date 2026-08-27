# Änderungen der mQorva Edition am OpenCode-Upstream

Alles, was der Fork am Original verändert. Jede Änderung ist hier so beschrieben, dass sie nach
einem Upstream-Update von Hand wieder eingepflegt werden kann, auch wenn der Merge sie verschluckt.

**Nach jedem `Sync-Upstream.ps1` in dieser Reihenfolge:**

```bash
pwsh ./patches.ps1
```

Das Skript meldet für jede Änderung, ob ihr Marker noch in der Datei steht. Danach `check.ps1` —
der Typecheck fängt Signaturänderungen ab, die der Marker nicht sieht.

Neue Shell-Komponenten liegen möglichst unter `packages/app/src/pages/layout-sidebar/`. Für die
Anbindung an bestehende OpenCode-Funktionen sind jedoch auch gezielte Änderungen an vorhandenen
Dateien erforderlich. Sämtliche dieser Integrationsflächen müssen in dieser Liste und in
`patches.ps1` erfasst sein.

---

## 1 — `packages/app/src/context/settings.tsx`

**Warum:** eigenes Setting für das Seitenleisten-Layout, unabhängig von `newLayoutDesigns` (das ist
ein auslaufender Migrationsschalter, siehe `oldInterfaceSunset`).

**a) Typ und Auflösung**, direkt vor `export interface Settings`:

```ts
export type LayoutMode = "tabs" | "sidebar"

export const layoutModeDefault: LayoutMode = "sidebar"

// The sidebar layout only exists on top of the new designs; the retired legacy shell gets no variant.
export function resolveLayoutMode(newLayout: boolean, preference: LayoutMode | undefined): LayoutMode {
  if (!newLayout) return "tabs"
  return preference ?? layoutModeDefault
}
```

**b) Feld** in `Settings.general`, nach `newLayoutDesigns?: boolean`:

```ts
    // Fork addition: alternate shell with a grouped session sidebar instead of titlebar tabs.
    layoutMode?: LayoutMode
```

**c) Memo** im Provider, direkt vor `const visible = (preference: ...)`:

```ts
const layoutMode = createMemo(() => resolveLayoutMode(newLayoutDesigns(), store.general?.layoutMode))
```

**d) Accessor** im zurückgegebenen `general`-Objekt, vor `layoutTransitionClassified`:

```ts
        layoutMode,
        setLayoutMode(value: LayoutMode) {
          if (layoutMode() === value) return
          setStore("general", "layoutMode", value)
        },
```

**Marker:** `resolveLayoutMode` · `layoutMode?: LayoutMode` · `setLayoutMode`

---

## 2 — `packages/app/src/components/settings-v2/general.tsx`

**Warum:** der Schalter in den Einstellungen.

Als erster Eintrag in `GeneralSection`, zwischen `<LanguageSetting />` und
`<PermissionScopeSetting … />`:

```tsx
<Show when={settings.general.newLayoutDesigns()}>
  <SettingsRowV2
    title={language.t("settings.general.row.sidebarLayout.title")}
    description={language.t("settings.general.row.sidebarLayout.description")}
  >
    <div data-action="settings-sidebar-layout">
      <Switch
        checked={settings.general.layoutMode() === "sidebar"}
        onChange={(checked) => settings.general.setLayoutMode(checked ? "sidebar" : "tabs")}
      />
    </div>
  </SettingsRowV2>
</Show>
```

**Marker:** `settings-sidebar-layout`

---

## 3 — `packages/app/src/components/titlebar.tsx`

**Warum:** im Seitenleisten-Layout listet die Leiste die Sitzungen, die Tab-Leiste in der
Titelzeile entfällt.

**a) Signatur** von `export function Titlebar(props: …)` erweitern:

```tsx
export function Titlebar(props: {
  update?: TitlebarUpdate
  debugTools?: { visible: boolean; toggle: () => void }
  // Fork addition: the sidebar layout lists sessions in its own sidebar, so it opts out of the tab strip.
  sessionTabs?: boolean
  distributedMenu?: boolean
}) {
```

**b)** Im v2-Zweig den Block aus `<TitlebarTabStrip … />` **und** dem direkt folgenden
`<TooltipV2>` mit dem „Neue Sitzung"-Knopf in
`<Show when={props.sessionTabs !== false}> … </Show>` einschließen. `distributedMenu` verteilt
Programmname und Windows-Menüs auf der nativen Titelzeile.

> Hinweis zum Diff: inhaltlich sind das zwei Zeilen, im `git diff` erscheinen aber rund 40, weil
> der eingeschlossene Block eine Ebene tiefer eingerückt wird. Bei einem Konflikt genügt es, den
> Upstream-Block zu übernehmen und nur den `<Show>`-Rahmen neu zu setzen.

**Marker:** `sessionTabs?: boolean` · `props.sessionTabs !== false` · `distributedMenu?: boolean`

---

## 4 — `packages/app/src/app.tsx`

**Warum:** Layout-Weiche und Startseiten-Verhalten.

**a) Importe** nach `import NewLayout from "@/pages/layout-new"`:

```tsx
import SidebarLayout from "@/pages/layout-sidebar/shell"
import { createHomeRoute } from "@/pages/layout-sidebar/home"
```

**b)** In `NewAppLayout` das feste `<NewLayout>` durch die Weiche ersetzen:

```tsx
function NewAppLayout(props: ParentProps<{ serverScoped?: JSX.Element }>) {
  const settings = useSettings()
  return (
    <SelectedServerProviders>
      <ServerScopedProviders serverScoped={props.serverScoped}>
        <Dynamic component={settings.general.layoutMode() === "sidebar" ? SidebarLayout : NewLayout}>
          {props.children}
        </Dynamic>
      </ServerScopedProviders>
    </SelectedServerProviders>
  )
}
```

**c)** In `Routes` die Startseite umhängen: `<Route path="/" component={NewHome} />` wird zu
`<Route path="/" component={SidebarAwareHome} />`.

**d)** Nach der `Routes`-Funktion:

```tsx
// Fork addition: "/" keeps the upstream home page for the tab layout and swaps to the sidebar
// layout's behaviour (straight back into the work) when that setting is on.
const SidebarAwareHome = createHomeRoute(() => <NewHome />)
```

**Marker:** `layout-sidebar/shell` · `SidebarAwareHome` · `layoutMode() === "sidebar"`

---

## 5 — `packages/app/src/context/layout.tsx`

**Warum:** Terminal und Seitenbereich sind globaler Layout-Zustand (`store.terminal.opened`,
`store.review.panelOpened`), aber bisher nur über `view(sessionKey)` erreichbar — und der braucht
die SDK-Provider, die es erst innerhalb der Session-Route gibt, also _unterhalb_ unserer Kopfzeile.
Deshalb ein schlüsselfreier Zugang auf dieselben Store-Felder.

Reine Ergänzung im zurückgegebenen Objekt, direkt nach dem `terminal`-Block:

```ts
      // Fork addition: terminal and review panel visibility are global store state, but so far only
      // reachable through view(sessionKey), which needs providers that only exist inside the session
      // route. The sidebar layout drives both panels from its shell header, above those providers.
      panels: {
        terminalOpened: createMemo(() => store.terminal?.opened ?? false),
        toggleTerminal() {
          const current = store.terminal
          if (!current) {
            setStore("terminal", { height: DEFAULT_TERMINAL_HEIGHT, opened: true })
            return
          }
          setStore("terminal", "opened", !(current.opened ?? false))
        },
        reviewPanelOpened: createMemo(() => store.review?.panelOpened ?? DEFAULT_REVIEW_PANEL_OPENED),
        toggleReviewPanel() {
          const current = store.review
          if (!current) {
            batch(() => {
              setStore("review", { diffStyle: "split" as ReviewDiffStyle, panelOpened: true })
              setEphemeral("reviewPanelSource", "other")
            })
            return
          }
          batch(() => {
            setStore("review", "panelOpened", !(current.panelOpened ?? DEFAULT_REVIEW_PANEL_OPENED))
            setEphemeral("reviewPanelSource", "other")
          })
        },
      },
```

Es schreibt exakt dieselben Felder wie `setTerminalOpened` / `setReviewPanelOpened` im
`view()`-Block; beide Wege bleiben synchron.

**Marker:** `toggleReviewPanel`

---

## 6 — `packages/app/src/i18n/en.ts` und `de.ts`

**Warum:** Beschriftungen. Reine Ergänzungen, konfliktarm.

Vor `"settings.general.row.newInterface.title"` einfügen — englische Fassung:

```ts
  "sidebarLayout.title": "Sessions",
  "sidebarLayout.toggle": "Toggle sidebar",
  "sidebarLayout.search": "Search sessions",
  "sidebarLayout.newChat": "New chat",
  "sidebarLayout.pinned": "Pinned",
  "sidebarLayout.projects": "Projects",
  "sidebarLayout.noSessions": "No sessions",
  "sidebarLayout.showMore": "Show more",
  "sidebarLayout.untitled": "Untitled session",
  "sidebarLayout.draft": "New chat",
  "sidebarLayout.openProject": "Open project",
  "sidebarLayout.terminal": "Toggle terminal",
  "sidebarLayout.reviewPanel": "Toggle side panel",
  "sidebarLayout.empty.title": "No project open",
  "sidebarLayout.empty.description": "Open a project in the sidebar to get started.",
  "settings.general.row.sidebarLayout.title": "Sidebar layout",
  "settings.general.row.sidebarLayout.description":
    "Sessions in a list on the left, grouped by project — instead of tabs in the title bar.",
```

Deutsche Fassung analog mit denselben Schlüsseln (siehe Datei; Groß-/Kleinschreibung folgt der
Wortart, Verben klein).

**Marker:** `sidebarLayout.title` · `settings.general.row.sidebarLayout.title`

---

## 7 — Desktop-Menü und Projektauswahl

- `packages/app/src/components/windows-app-menu.tsx` verteilt Programmname und Hauptmenüs in der
  nativen Titelzeile. **Marker:** `desktop-app-menu-bar`
- `packages/app/src/components/directory-picker.tsx` bevorzugt auf dem Desktop den vorhandenen
  nativen Verzeichnisdialog. Ein Aufrufer kann mit `preferInternal` ausdrücklich den internen
  Browser verlangen. **Marker:** `preferInternal?: boolean`
- `packages/app/src/pages/home/home-controller.ts` gibt beim Hinzufügen eines Projekts ein Promise
  zurück, das erst nach der vorhandenen OpenCode-Projektregistrierung erfüllt ist. Die mQorva-Shell
  wartet darauf, bevor sie die erste echte Sitzung anlegt; dadurch bleibt deren `projectID` korrekt.
  **Marker:** `const registrations = directories.map`

## 8 — Kopfzeilen und Panel-Schalter

- `packages/app/src/components/session/session-header.tsx` zeigt im Seitenleisten-Layout nur
  `Projekt / Chat` und die einheitlichen Schalter für Terminal und rechten Bereich.
  **Marker:** `sidebarLayout = createMemo`
- `packages/app/src/pages/new-session.tsx` stellt dieselben Bereiche bereits im neuen Chat bereit
  und bindet den vorhandenen Dateibaum sowie das Terminal ein. **Marker:** `draft-workspace-panel`
- `packages/app/src/pages/new-session/new-session-view.tsx` entfernt im Seitenleisten-Layout die
  doppelte Projektauswahl aus dem Composer. Ein sichtbarer Provider-Hinweis liegt dort im normalen
  vertikalen Layoutfluss und reserviert seine Höhe, damit er den Promptbereich nicht überdeckt.
  **Marker:** `const sidebarLayout = () =>` · `providerTip.present()`

## 9 — Sitzungscontainer

- `packages/app/src/pages/session.tsx` integriert Chat, rechten OpenCode-Bereich und Terminal in
  die rahmenlose mQorva-Shell und berücksichtigt deren veränderbare Größen.
  **Marker:** `const sidebarLayout = createMemo`
- `packages/app/src/pages/session/session-side-panel.tsx` übernimmt im Seitenleisten-Layout die
  volle Containerhöhe und verwendet weiterhin die vorhandenen Review- und Datei-Funktionen.
  **Marker:** `layoutMode() !== "sidebar"`

## 10 — Editions- und Buildmetadaten

- `packages/app/src/context/platform.tsx` ergänzt optionale Editionsmetadaten, ohne
  `platform.version` und damit den OpenCode-Kompatibilitätswert zu verändern.
- `packages/app/src/components/dialog-settings.tsx` und
  `packages/app/src/components/settings-v2/dialog-settings-v2.tsx` zeigen OpenCode-Version,
  mQorva-Revision und Build-Commit an.
- `packages/desktop/electron.vite.config.ts` bindet die Metadaten aus `mqorva-version.json` in den
  Renderer ein.
- `packages/desktop/electron-builder.config.ts` versieht lokale Pakete mit einem nachvollziehbaren
  mQorva-Dateinamen.

## 11 — Getrennte Desktop-Installation

- `packages/desktop/identity.ts` ist die zentrale Quelle für mQorva-App-IDs, Produktnamen, die
  früheren OpenCode-IDs und `opencode-mqorva://`.
- `packages/desktop/src/main/index.ts` setzt mQorva-App-ID, Datenverzeichnis und Protokoll und
  normalisiert mQorva-Deep-Links erst intern für die vorhandene OpenCode-Auswertung.
- `packages/desktop/src/main/mqorva-migration.ts` übernimmt einmalig ausschließlich persistente
  Desktop-Einstellungen und Entwürfe in ein leeres mQorva-Profil.
- `packages/desktop/src/main/constants.ts` deaktiviert den offiziellen Updater. mQorva-Builds
  dürfen niemals aus den offiziellen OpenCode-Repositories aktualisiert oder dorthin veröffentlicht
  werden.
- `packages/desktop/src/main/server.ts` und `packages/desktop/src/main/sidecar.ts` isolieren die
  Umgebungsvariablen `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` und `XDG_STATE_HOME`
  auf das mQorva-spezifische `userDataPath`. Dadurch erhält die mQorva-Edition ihre eigene
  SQLite-Datenbank (`opencode.db`) und eigene Lock-Dateien und kann vollständig parallel zur
  offiziellen OpenCode-Installation betrieben werden.
  *Rückgängig machen:* In beiden Dateien lediglich die drei Zuweisungen für `XDG_DATA_HOME`,
  `XDG_CONFIG_HOME` und `XDG_CACHE_HOME` entfernen (dann wird wieder der globale Standardordner
  `%LOCALAPPDATA%\opencode` genutzt).
- `packages/desktop/src/main/background-cli.ts` durchsucht nur noch mQorva-eigene App-IDs nach
  laufenden Daemons, um eine Kopplung an Daemons des originalen OpenCode zu verhindern.
- `packages/desktop/src/main/index.ts` nutzt im Entwicklungsmodus standardmäßig Port 9223 für den
  Remote-Debugging-Port, um Portkonflikte mit 9222 des Original-OpenCode zu vermeiden.
- `packages/desktop/scripts/copy-metainfo.ts` und `electron-builder.config.ts` erzeugen auch auf
  Linux ausschließlich mQorva-Identitäten; der frühere offizielle Kompatibilitätslauncher wird
  nicht mitgeliefert.

## 12 — Bestätigter Provider-Lebenszyklus

**Warum:** Die Provider-Endpunkte bestätigen zunächst nur, dass Schlüssel, Credential oder
Konfiguration gespeichert beziehungsweise entfernt wurden. Der sichtbare Provider-Katalog hängt
zusätzlich an einer verzeichnisbezogenen OpenCode-Instanz und an mehreren Query-Caches. Ohne
explizites Neuladen konnte die Oberfläche deshalb Erfolg melden, obwohl sie weiterhin den alten
Zustand zeigte.

- `packages/app/src/components/provider-connection.ts` enthält den gemeinsamen Abschlussvertrag
  für Verbinden, benutzerdefinierte Provider und Trennen: Mutation abwarten, nur die betroffene
  Instanz neu laden, den passenden Katalog aktualisieren und den erwarteten Zustand prüfen.
- `dialog-connect-provider.tsx` verwendet denselben Vertrag für API-Schlüssel, OAuth-Code und
  automatisches OAuth. Fehler beim abschließenden Aktualisieren bleiben im Dialog sichtbar;
  Mehrfachübermittlungen werden während der laufenden Aktion gesperrt.
- `dialog-custom-provider.tsx` wartet nach Schlüssel und Konfiguration ebenfalls auf die
  bestätigte Katalogaktualisierung. Beim Reaktivieren wird `disabled_providers` bereinigt.
- Beide Provider-Einstellungsoberflächen verwenden denselben Trennablauf. Bei V1 werden alte
  Auth-Einträge entfernt und konfigurationsbasierte Provider deaktiviert; bei V2 werden die echten
  Credential-IDs der Integration entfernt. Ein Erfolgstoast erscheint erst nach bestätigtem
  Verschwinden aus der Liste.
- `context/server-sync.tsx` kann Provider-Abfragen global, nur global oder für genau ein
  Verzeichnis aktualisieren. Dadurch wird nicht mehr jede offene Projektinstanz neu aufgebaut.
- `utils/server-compat.ts` lädt nach V1-Key- und OAuth-Mutationen nur die adressierte Instanz neu.

**Abgrenzung zum Original:** Die fehlende Kopplung zwischen Auth-/Config-Mutation,
Instanz-Neuladen und sichtbarem Katalog ist ein Upstream-Problem. Die zwei parallel gepflegten
Settings-Oberflächen und der benutzerdefinierte Provider-Dialog vergrößerten es im Fork. Der
gemeinsame Abschlussvertrag ist daher als Upstream-Kandidat geeignet; die mQorva-spezifische
Dokumentation und UI-Einbindung bleiben Fork-Aufgabe.

**Marker:** `confirmProviderConnection` · `disconnectProviderConnection` ·
`refreshProviders(directory?: string | null)`

---

## 13 — Follow-up-Verhalten: Queue bleibt wählbar (Upstream-Kandidat)

**Warum:** Upstream kennt `followup: "queue" | "steer"` als Setting-Typ, zwingt `"queue"` aber an
drei Stellen auf `"steer"` um (Effect, Fallback, Setter) — die Auswahl ist unerreichbar. Der Fork
lässt beide Werte zu, stellt die Auswahl in den Einstellungen sichtbar und macht Strg+Enter zum
Gegenteil der eingestellten Vorgabe (steuert statt parkt bzw. parkt statt steuert). Kein
Sidebar-Bezug; als Feature auch für das Original sinnvoll (siehe
`plans/upstream-kandidaten.md`, Kandidat #22).

- `packages/app/src/context/settings.tsx` entfernt die drei Umzwing-Stellen; `followup` liest den
  gespeicherten Wert unverändert.
- `packages/app/src/components/settings-v2/general.tsx` ergänzt die Auswahlzeile
  (`followupOptions`, `data-action="settings-followup"`).
- `packages/app/src/components/prompt-input/submit.ts` nimmt `options?: { invert?: boolean }` an
  `handleSubmit` entgegen.
- `packages/session-ui/src/v2/components/prompt-input/interaction.ts` reicht Ctrl/Cmd+Enter als
  `invert` durch und liest bei leerem Store zusätzlich den DOM-Text (`hasContent`).
- `i18n/en.ts`/`de.ts`: neue Beschreibung der Zeile sowie `session.followupDock.steer` /
  `.drag`.

**Marker:** `settings-followup` · `invert?: boolean` · `onSubmit: (invert?: boolean) => void`

---

## 14 — Session-UI-Nähte am Prompt-Composer

**Warum:** gemeinsame Composer-Bausteine brauchen kleine, rückwärtskompatible Erweiterungen.

- `packages/session-ui/package.json`: zusätzlicher Export `./v2/prompt-input/editor-dom`.
- `packages/session-ui/src/v2/components/prompt-input/index.tsx`: neuer Slot
  `slotAfterControls`; Oberfläche und Verläufe folgen `var(--prompt-input-surface, …)`;
  Enter-Reichweite übergibt Ctrl/Cmd+Enter als `invert`.
- `packages/session-ui/src/v2/components/prompt-input/editor-dom.ts` (neu): der vorher private
  Editor-Parser, unverändert ausgelagert; genutzt vom DOM-Sync-Fallback in `submit.ts`
  (Kandidat #15 in `plans/upstream-kandidaten.md`).

**Marker:** `./v2/prompt-input/editor-dom` · `slotAfterControls` · `--prompt-input-surface`

---

## 15 — Entwürfe ohne Projektzuordnung

**Warum:** die Seitenleiste gruppiert Entwürfe im Block „Chats“, bis ein Projekt gewählt ist.

- `packages/app/src/context/tabs.tsx`: optionales `unassigned?: boolean` am `DraftTab`;
  `directory` trägt weiterhin einen lauffähigen Ort für die erste Nachricht.
- `packages/app/src/context/tab-migration.ts`: erhält das Flag beim Lesen alter Speicherstände.

**Marker:** `unassigned?: boolean` · `tab.unassigned === true`

---

## 16 — Timeline-Naht (`pages/session/timeline/message-timeline.tsx`)

**Warum:** Kopfzeile, Nachrichtenleiste und Titel passen sich dem Seitenleisten-Layout an; Teile
wirken bewusst auch im Tab-Modus.

- `HeaderSlot`-Portal: im Sidebar-Modus wandert die Titelleiste in den Sitzungskopf.
- `MessageRail` + `message-rail-text.ts/.css` (neu): schmale Nachrichtenleiste links, gerendert ab
  Viewport ≥520×320 **in beiden Layouts**.
- `titleLabel` nutzt Fork-Util `isNewChat` mit lokalisiertem Platzhalter.
- ScrollView mit `thumbVisibility="always"` und `thumbContainer` (Paar mit dem Scrollbar-Stepper
  in `pages/session.tsx`).
- Im gesamten V2-Zweig ist `SessionContextUsage` ausgeblendet (Paar mit dem Slot in
  `prompt-input-v2.tsx`); Share-Popover im V2-Zweig überarbeitet.

**Marker:** `HeaderSlot` · `MessageRail` · `sidebarLayout.newChat`

---

## 17 — Standardbreite der Seitenleiste

**Warum:** Design-Feinschliff; betrifft beide Layouts.

- `packages/app/src/context/layout.tsx`: `DEFAULT_SIDEBAR_WIDTH` 344→280 inklusive Migration
  gespeicherter 344er-Werte.

**Marker:** `width === 344 ? DEFAULT_SIDEBAR_WIDTH : width`

---

## 18 — Desktop: experimentelle Icon-Discovery deaktiviert

**Warum:** `OPENCODE_EXPERIMENTAL_ICON_DISCOVERY=true` wurde aus
`packages/desktop/src/main/server.ts` entfernt; die Gründe sind nicht dokumentiert. Negative
Änderungen kann `patches.ps1` per Marker nicht prüfen — nach jedem Sync dort von Hand
kontrollieren, dass die Zeile nicht zurückkehrt.

---

## Sichtbare Abweichungen im Tab-Modus (bewusst akzeptiert)

Der Umschalter bleibt voll bedienbar; folgende Unterschiede zum Original im Tab-Modus sind
gewollt und werden nicht zurückgebaut:

1. Draft-Seite mit eigenem Header, Terminal und Workspace-Panel (`new-session.tsx`, Abschnitt 8);
   das Status-Popover im Titlebar-Rechtsmount entfällt.
2. Terminal immer in voller Breite unten, nie gestapelt neben dem Review-Panel (`session.tsx`,
   Abschnitt 9).
3. `MessageRail` auch im Tab-Modus (Abschnitt 16).
4. Composer-Breite `max-w-200` und Context-Usage-Slot in beiden Modi (Abschnitte 14, 16).

## Was bewusst NICHT geändert wurde

- **`pages/layout.tsx`** und `pages/layout/*` — das Legacy-Layout wird upstream verschwinden. Was
  die mQorva Edition davon braucht, importiert sie über `pages/layout-sidebar/upstream.ts`; bricht das weg,
  wird dort kopiert statt in der Upstream-Datei geändert.
- **OpenCode-Datenmodelle und APIs für Projekte und Sitzungen** — die mQorva-Shell ruft die
  vorhandenen OpenCode-Wege auf und führt dafür keine parallelen fachlichen Speicher ein.
