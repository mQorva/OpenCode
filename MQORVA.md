# OpenCode – mQorva Edition

Die mQorva Edition ist eine angepasste Desktop-Ausgabe von OpenCode. Sie verändert die
Arbeitsoberfläche und bindet dabei weiterhin die vorhandenen OpenCode-Funktionen für Projekte,
Sitzungen, Dateien, Terminal, Modelle und Einstellungen ein.

## Versionsmodell

OpenCode-Basis und mQorva-Anpassungen werden getrennt ausgewiesen:

- **OpenCode-Version:** unveränderte Paket- und Protokollversion des Upstreams
- **mQorva-Revision:** fortlaufender Stand der mQorva-Anpassungen
- **Upstream-Commit:** exakter OpenCode-Stand, auf dem die Revision basiert
- **Build-Commit:** beim Build ermittelter Git-Commit; `-dirty` kennzeichnet nicht eingecheckte Änderungen

Die kanonischen Angaben stehen in `mqorva-version.json`. Ein Stand wird beispielsweise als
`OpenCode 1.18.18 · mQorva r1 · e23586af26-dirty` angezeigt. Die originale OpenCode-Version
bleibt dadurch für Kompatibilitäts- und Updateprüfungen erhalten.

## Repository und Branches

- `upstream`: offizielles Repository `anomalyco/opencode`
- `origin`: mQorva-Repository `mQorva/OpenCode`
- `dev`: Integrationsbranch der mQorva Edition auf Basis von `upstream/dev`

Änderungen der mQorva Edition werden als normale Git-Commits auf `dev` gesichert. Ein
Upstream-Update darf nur mit sauberem Arbeitsverzeichnis erfolgen. Dadurch bleibt jeder eigene
Stand über Git wiederherstellbar und ein Merge kann keine noch nicht gesicherten Anpassungen
überschreiben.

## Desktop-Identität

Die mQorva Edition beansprucht keine offizielle OpenCode-Installationsidentität:

- Produktion: `de.mqorva.opencode.desktop`
- Beta: `de.mqorva.opencode.desktop.beta`
- Entwicklung: `de.mqorva.opencode.desktop.dev`
- Deep Links: `opencode-mqorva://`

Produktnamen, Windows-Verknüpfungen, Deinstallationseinträge und Linux-Desktop-Dateien verwenden
`OpenCode mQorva`. Der offizielle `opencode://`-Handler und die offiziellen OpenCode-Updaterziele
bleiben unangetastet. Upstream-Aktualisierungen erfolgen ausschließlich über den dokumentierten
Merge- und Prüfablauf.

Beim ersten Start übernimmt ein leeres mQorva-Profil einmalig vorhandene Desktop-Einstellungen,
Projektlisten, Arbeitsbereichszustände und Entwürfe aus dem entsprechenden früheren
OpenCode-Profil. Chromium-Caches, Cookies, Protokollregistrierungen und Logdateien werden nicht
kopiert. Ein bereits initialisiertes mQorva-Profil wird niemals überschrieben.

## Aktualisierung aus OpenCode

1. Aktuellen mQorva-Stand committen und auf `origin` sichern.
2. Status ohne Änderungen prüfen: `./sync.ps1 -Status`.
3. Upstream übernehmen: `./sync.ps1 -Update`.
4. Konflikte beheben und die Prüfungen erneut ausführen.
5. `CHANGELOG.mqorva.md` ergänzen und eine neue mQorva-Revision festlegen, wenn ein neuer
   verteilter Stand entsteht.
6. Den geprüften Stand mit `mqorva-v<OpenCode-Version>-r<Revision>` taggen.

`sync.ps1 -Update` verweigert die Ausführung bei einem nicht sauberen Arbeitsverzeichnis. Es
öffnet den Upstream-Merge zunächst ohne Commit, aktualisiert die OpenCode-Basis in
`mqorva-version.json`, prüft die mQorva-Marker und führt die paketbezogenen Typechecks aus. Erst
danach wird der gemeinsame, nachvollziehbare Merge-Commit erstellt. Bei Konflikten oder
fehlgeschlagenen Prüfungen bleibt der Merge zur manuellen Korrektur geöffnet.

## Änderungsgrenze

`CHANGELOG.mqorva.md` beschreibt sichtbare Änderungen der Edition. Technische Eingriffe in
vorhandene OpenCode-Dateien und ihre Wartungsmarker stehen in `plans/upstream-patches.md`.
Eigene Komponenten sollen möglichst in klar abgegrenzten mQorva-Dateien liegen und vorhandene
OpenCode-APIs verwenden, statt Projekt-, Sitzungs- oder Einstellungslogik zu duplizieren.

## Veröffentlichung

Lokale Windows-Pakete werden standardmäßig als mQorva-Ausgabe benannt:

```text
opencode-mqorva-<OpenCode-Version>-r<Revision>-<Build-Commit>-win-<Architektur>.exe
```

Der Dev- und Produktionskanal verwenden eine eigene Electron-App-ID sowie vollständig isolierte
Backend-Verzeichnisse (`XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_STATE_HOME`
innerhalb von `userDataPath`). Dadurch verfügt mQorva über eine eigene SQLite-Datenbank (`opencode.db`)
und eigene Lock-Dateien, sodass die offizielle OpenCode-App und mQorva komplett parallel laufen können.

`package.ps1` erstellt standardmäßig zuerst einen vollständigen frischen Build. Nur
`package.ps1 -SkipBuild` verwendet ausdrücklich einen bereits vorhandenen Desktop-Build. Für
laufende UI-Arbeit ist `bun run dev:desktop` vorgesehen; dadurch muss nicht für jede visuelle
Änderung ein Installer erzeugt werden.
