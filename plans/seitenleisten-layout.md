# Plan: Seitenleisten-Layout (alternatives Layout im OpenCode-Fork)

Stand: 2026-08-16 · Branch: `dev`

## Umsetzungsstand

Phasen 1–4 sind gebaut. `check.ps1` grün über alle fünf Pakete, 19 eigene Tests grün.

| Phase | Stand |
|---|---|
| 1 — Setting und Verzweigung | fertig |
| 2 — Layout-Gerüst | fertig, inklusive Panel-Toggles |
| 3 — Sitzungsliste | fertig |
| 4 — Navigation ohne Tabs | fertig, bis auf Tastaturwege |
| 5 — Feinschliff | offen |

**Live geprüft** (Web-Modus gegen einen lokalen Server): Schalter greift · Titelzeile verliert Tab-Strip und Neu-Knopf · Seitenleiste klappt auf und zu · Kopfzeile trägt den Toggle links und die Panel-Schalter rechts · Projektgruppe rendert mit Namen · Sitzung erscheint eingerückt darunter · Klick darauf navigiert zur Session-Route · Terminal und Seitenbereich schalten von der Kopfzeile aus · Entwurf erscheint unter seinem Projekt · Startseite führt direkt in die Arbeit statt zur Projektübersicht · leerer Zustand ohne Projekt · Verzeichnis-Dialog öffnet und öffnet ein Projekt.

**Nicht live geprüft:** Anheften über das Kontextmenü und das Ziehen eines Entwurfs in ein anderes Projekt — beides über Unit-Tests der Logik abgedeckt, aber nicht im Fenster bedient.

### Offen

- **Tastaturwege.** Befehle, die Tab-Semantik voraussetzen (Tab wechseln/schließen, zuletzt geschlossene wiederherstellen), sind noch nicht auf Listen-Semantik abgebildet.
- **Breite der Seitenleiste** ist fest auf 320 px; ziehen zum Verändern fehlt (`layout.sidebar.resize` liegt bereit).
- **Phase 5** insgesamt: Umbenennen/Archivieren aus der Liste, Feinschliff an Hover- und Scrollverhalten.

## Ziel

Ein zusätzliches, per Einstellung wählbares Layout für die OpenCode-Desktop-App:

- **links** eine Sitzungsleiste, gruppiert nach Projekt
- **Mitte** der bestehende Agenten-/Session-Bereich
- **keine** Tab-Leiste in der Titelzeile
- Ein-/Ausklapp-Schalter für linke Leiste und rechtes Panel — **nicht** in der Fensterleiste, sondern in der ersten Inhaltszeile darunter, links und rechts auf gleicher Höhe

Vorbild ist die Codex-Desktop-App (Screenshots liegen in der Abstimmung vor); die Umsetzung übernimmt die Struktur, nicht die Marke.

## Leitprinzip: Fork-Strategie

Der Upstream-Code bleibt unangetastet, wir ergänzen nur. Konkret:

1. **Neue Dateien statt Änderungen.** Alles Layout-Spezifische liegt in `packages/app/src/pages/layout-sidebar/`. In Upstream-Dateien werden nur Einhängepunkte ergänzt (Zielgröße: unter 60 geänderte Zeilen insgesamt).
2. **Kein Andocken an `newLayoutDesigns`.** Dieses Flag ist ein Migrationsschalter, kein Wahlschalter: Default steht auf `true`, es gibt `oldInterfaceRetired`, `oldInterfaceSunset = 14.09.2026` und einen Upgrade-Cutoff auf `1.17.19` ([context/settings.tsx:60-132](../packages/app/src/context/settings.tsx)). Upstream schafft die alte Oberfläche ab. Wir bekommen ein eigenes, unabhängiges Setting.
3. **Legacy-Code kopieren, nicht importieren.** Die vorhandene Projekt-Leiste (`pages/layout/sidebar-shell.tsx`, `sidebar-project.tsx`, `sidebar-workspace.tsx`, `sidebar-items.tsx`) gehört zum Legacy-Layout und wird upstream verschwinden. Was wir davon brauchen, wird in unseren Ordner kopiert.
4. **`TabsProvider` bleibt.** Er ist nicht nur Optik, sondern der Zustandsspeicher offener Sitzungen; Routing (`/new-session?draftId=…`), Drafts und Redirects hängen daran ([context/tabs.tsx](../packages/app/src/context/tabs.tsx), [app.tsx:82-101, 638-646](../packages/app/src/app.tsx)). Wir blenden nur die Tab-Leiste aus und rendern denselben Zustand als Liste.

## Setting

Name für den Nutzer: **„Seitenleisten-Layout"**
Beschreibung: „Sitzungen in einer Liste links, gruppiert nach Projekt — statt Tabs in der Titelleiste."

| | |
|---|---|
| Interface-Feld | `Settings.general.layoutMode?: "tabs" \| "sidebar"` |
| Default | `"sidebar"` (Fork-Verhalten; Tabs bleiben in den Einstellungen wählbar) |
| Wirksam | nur wenn `newLayoutDesigns()` aktiv ist — das Legacy-Layout bekommt keine Variante |
| i18n-Keys | `settings.general.row.sidebarLayout.{title,badge,description}` |

Ablage: `context/settings.tsx` (Feld + Accessor `general.layoutMode()` / `setLayoutMode()`), Schalter in `components/settings-v2/general.tsx` direkt unter dem bestehenden `InterfaceSection`.

## Phasen

### Phase 1 — Setting und Verzweigung

- `Settings.general.layoutMode` ergänzen, Accessor analog zu `newLayoutDesigns`
- Schalter in `settings-v2/general.tsx`, i18n-Keys in `i18n/de.ts` und `i18n/en.ts`
- In `app.tsx` bei `NewAppLayout` ([app.tsx:371](../packages/app/src/app.tsx)) auf `layoutMode()` verzweigen: `NewLayout` oder neues `SidebarLayout`
- `SidebarLayout` ist zunächst eine Kopie von [layout-new.tsx](../packages/app/src/pages/layout-new.tsx) (49 Zeilen) — Umschalten funktioniert, Optik noch identisch

*Ergebnis: Schalter greift, nichts sieht anders aus. Sauberer Zwischenstand zum Committen.*

### Phase 2 — Layout-Gerüst

Neu: `pages/layout-sidebar/shell.tsx`, `header.tsx`, `sidebar.tsx`

- Drei Zonen: Seitenleiste (Standardbreite 410 px, links) · Inhalt (Mitte) · rechtes Panel (bestehend)
- Titelzeile bleibt die Upstream-`Titlebar` und wird **nicht** kopiert. Sie enthält plattformspezifische Feinheiten, die man nicht nachbauen will: Freiraum für die macOS-Ampeln, Windows-Fensterknöpfe über `env(titlebar-area-width)`, Zoom-Kompensation ([titlebar.tsx:46-92, 182-187](../packages/app/src/components/titlebar.tsx)). Menüs, Zurück/Vor und Fensterknöpfe wollen wir unverändert.
- Einziger Eingriff dort: ein Prop, das `TitlebarTabStrip` weglässt (~15 Zeilen). Alles Neue liegt in der Kopfzeile darunter und ist vollständig unser Code.
- Erste Inhaltszeile bekommt die Toggles:
  - **links** Seitenleisten-Toggle, in der Kopfzeile der Leiste
  - **rechts** Toggles für unteres Panel (Terminal) und rechtes Panel
  - Bei **eingeklappter** Leiste rutscht der linke Toggle in die Inhalts-Kopfzeile auf dieselbe Höhe — der Knopf bleibt immer in derselben Zeile, nur die Spalte wechselt
- Wiederverwendbar: `layout.sidebar.toggle` und der Command `sidebar.toggle` existieren bereits in `context/layout.tsx` und werden im Legacy-Zweig der Titlebar verwendet ([titlebar.tsx:480-535](../packages/app/src/components/titlebar.tsx))
- Breite und Auf/Zu-Zustand persistieren (analog `session-panel-width.ts`)

### Phase 3 — Sitzungsliste

Neu: `pages/layout-sidebar/session-list.tsx`, `session-group.tsx`

Aufbau von oben nach unten, nach Screenshot-Vorlage:

1. Kopfzeile: Workspace-/Server-Auswahl, Suche, Seitenleisten-Toggle
2. Eine feste Aktion: „Neuer Chat" mit `+`
3. Gruppe „Angeheftet"
4. Gruppe „Projekte": Ordner-Icon + Projektname, eingerückt die Sitzungen
5. Lange Listen mit „Mehr anzeigen", leere Projekte grau mit „keine Sitzungen"
6. Fußzeile: Konto links, Hilfe rechts

Datenquellen sind vorhanden: Projektliste über `context/layout.tsx` (`LocalProject`), Sitzungen über die Home-Ansicht ([home/home-sessions-view.tsx](../packages/app/src/pages/home/home-sessions-view.tsx), 550 Zeilen) und `home-sessions-controller.tsx`. Die Gruppierungs- und Sortierlogik von dort wird übernommen, nicht neu erfunden. Projekt = Worktree entspricht dem bestehenden OpenCode-Modell; es wird nichts umgruppiert.

**Anheften** hat OpenCode heute nicht (Archivieren gibt es, siehe `home-session-archive.ts`). Wir brauchen also einen eigenen persistierten Zustand — eine Liste angehefteter Sitzungs-IDs analog zum Muster in `context/tabs.tsx` (`persisted(Persist.window(...))`). Das ist reine Ergänzung und kollidiert nicht mit Upstream.

### Phase 4 — Navigation ohne Tabs

Sitzungen bleiben inhaltlich unverändert offen und laufen im Hintergrund weiter — es ändert sich nur die Darstellung: Liste statt Tab-Leiste. Der Tabs-Store bleibt unangetastete Wahrheit.

- Klick auf eine Sitzung navigiert über `tabHref(tab)` bzw. `sessionHref(...)`; die Liste markiert die aktive Sitzung, offene erkennbar über `sessionHasOpenTab(...)`
- „Neuer Chat" legt weiterhin einen Draft an (`tabs.newDraft`) und startet im gerade gewählten Projekt; Ziel ist `/new-session?draftId=…`
- **Drag & Drop:** ein Draft lässt sich per Ziehen in ein anderes Projekt umhängen. `DraftTab` trägt bereits `directory` und `worktree` ([context/tabs.tsx:23-29](../packages/app/src/context/tabs.tsx)) — es wird also nur dieses Feld gesetzt, keine neue Datenstruktur nötig. `@thisbeyond/solid-dnd` ist im Projekt schon in Gebrauch (Legacy-Sidebar), die Muster lassen sich übernehmen.
  *Einschränkung:* Nur Entwürfe sind verschiebbar. Eine gestartete Sitzung hängt am Arbeitsverzeichnis ihres Servers und kann nicht nachträglich in ein anderes Projekt wandern — sie wird beim Ziehen abgelehnt (kein Drop-Ziel), statt etwas vorzutäuschen.
- Tastaturwege prüfen, die heute an Tabs hängen (Tab wechseln, Tab schließen, zuletzt geschlossene wiederherstellen aus `closed-tabs.ts`) — im Seitenleisten-Layout auf Listen-Semantik abbilden

### Phase 5 — Feinschliff und Sync-Sicherung

- Leere Zustände, Hover, aktive Markierung, Scrollverhalten bei vielen Sitzungen
- Umbenennen/Archivieren aus der Liste heraus (Kontextmenü), soweit vorhandene Aktionen das hergeben
- `plans/`-Eintrag und kurze Notiz in `CONTEXT.md`, welche Upstream-Dateien wir berühren — damit ein späterer `git-sync.ps1 -Update`-Merge die Stellen gezielt prüfen kann

## Berührte Upstream-Dateien (bewusst klein gehalten)

| Datei | Änderung |
|---|---|
| `context/settings.tsx` | Feld `layoutMode` + Accessor |
| `components/settings-v2/general.tsx` | ein Schalter |
| `i18n/de.ts`, `i18n/en.ts` | drei Keys je Sprache |
| `app.tsx` | eine Verzweigung bei `NewAppLayout` |
| `components/titlebar.tsx` | Prop zum Weglassen des Tab-Strips (~15 Zeilen) |
| `context/layout.tsx` | schlüsselfreier Zugang auf die Panel-Zustände (~28 Zeilen, reine Ergänzung) |

Tatsächlicher Umfang nach der Umsetzung: 7 Dateien, rund 90 geänderte Zeilen, davon etwa 40 reine Einrückung. Alles Weitere liegt in `pages/layout-sidebar/` (`shell.tsx`, `header.tsx`, `sidebar.tsx`, `session-item.tsx`, `home.tsx`, `sessions.ts`, `upstream.ts` plus zwei Testdateien).

**Jede dieser Änderungen ist einzeln in [upstream-patches.md](upstream-patches.md) dokumentiert und wird von `patches.ps1` geprüft.** Nach jedem `git-sync.ps1 -Update`: erst `patches.ps1` (meldet verschluckte Anpassungen), dann `check.ps1` (fängt Signaturänderungen).

Alles Weitere liegt in `pages/layout-sidebar/`.

## Risiken

- **Upstream entfernt das Legacy-Layout.** Betrifft `pages/layout.tsx` (2455 Zeilen) und `pages/layout/*`. Wenn wir von dort importieren, bricht der nächste Sync. Deshalb kopieren.
- **Der Tab-Zustand ist tief verdrahtet.** `app.tsx` enthält Redirects, die Tabs voraussetzen. Da der Store unverändert bleibt und wir ihn nur anders darstellen, ist das entschärft — kritisch bleiben allein die Tastaturwege, die heute Tab-Semantik voraussetzen.
- **Sunset am 14.09.2026.** Ab dann erzwingt Upstream `newLayoutDesigns = true`. Für uns unkritisch, solange unser Schalter eigenständig ist — aber der Code um `oldInterfaceRetired` wird sich ändern und ist Merge-Konfliktzone.
- **Zwei Layouts, ein Test-Set.** Bestehende Tests decken den Tab-Pfad ab. Für den Seitenleisten-Pfad brauchen wir eigene Tests, sonst merkt niemand, wenn ein Sync ihn kaputtmacht.

## Geklärt (15.08.2026)

1. **Sitzungswechsel:** Sitzungen bleiben offen und laufen im Hintergrund weiter, genau wie heute mit Tabs. Nur die Darstellung wechselt. → Tabs-Store bleibt unverändert Wahrheit, Phase 4 wird dadurch deutlich kleiner als befürchtet.
2. **Feste Aktionen:** zunächst nur „Neuer Chat". Startet im gewählten Projekt, per Drag & Drop in ein anderes Projekt umhängbar.
3. **Angeheftet:** kommt dazu — eigener persistierter Zustand nötig, siehe Phase 3.
4. **Projekt/Worktree:** bildet OpenCode bereits korrekt ab, keine Änderung am Datenmodell.

5. **Anheften betrifft nur Sitzungen.** Projekte sind selbst die Gruppe, ein Anheften wäre sinnlos.

## Was ein Upstream-Update wirklich bedeutet

Kurz: Merge-Konflikte werden selten, aber Bruch durch geänderte Schnittstellen bleibt möglich. Es gibt keine Automatik, die uns davor schützt.

**Was gut geschützt ist** — unsere eigenen Dateien unter `pages/layout-sidebar/`. Upstream fasst sie nie an, es gibt dort nie einen Merge-Konflikt.

**Was Konflikte erzeugen kann** — die vier Upstream-Dateien, in die wir uns einhängen. Der Diff ist klein und an klar abgegrenzten Stellen, aber `app.tsx` und `context/settings.tsx` sind gerade in Bewegung (Sunset-Umbau). Konflikte dort sind sichtbar und in Minuten aufzulösen.

**Was still brechen kann — der eigentliche Punkt.** Unser Layout *benutzt* Upstream-Bausteine: `Titlebar`, `IconButton`/`IconButtonV2`, `context/layout.tsx` (`LocalProject`, `sidebar.toggle`), `context/tabs.tsx` (`Tab`, `tabHref`, `newDraft`), die Session-Seite, die Panel-Komponenten. Ändert Upstream eine dieser Signaturen, gibt es **keinen** Merge-Konflikt — der Merge geht glatt durch und es bricht erst beim Bauen oder zur Laufzeit.

Absicherung dagegen:

1. Nach jedem Sync `check.ps1` laufen lassen. TypeScript fängt Signaturänderungen ab, das ist die stärkste Einzelmaßnahme.
2. Eigene Tests für den Seitenleisten-Pfad (Gruppierung, Anheften, Draft-Verschieben). Ohne die merkt niemand, wenn Verhalten wegbricht, das kompiliert.
3. Die benutzten Upstream-Schnittstellen an einer Stelle bündeln (`pages/layout-sidebar/upstream.ts`) statt quer über alle Dateien zu importieren. Dann liegt jeder Anpassungsbedarf nach einem Sync in einer Datei.
4. Diese Liste im Plan aktuell halten, damit nach einem Sync klar ist, wo gezielt zu prüfen ist.

Realistische Erwartung: Der laufende Fall ist „Sync läuft durch, `check.ps1` grün, fertig". Der Ausnahmefall ist „Upstream hat Baustein X umgebaut, wir ziehen an einer Stelle nach". Der teure Fall wäre, dass Upstream das Layout-Konzept selbst umbaut — dann ist Nacharbeit fällig, egal wie sauber wir uns einhängen.
