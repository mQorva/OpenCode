# Änderungen der mQorva Edition

Dieses Änderungsprotokoll enthält ausschließlich Anpassungen der mQorva Edition. Änderungen des
OpenCode-Upstreams werden weiterhin durch dessen Versionsstand und Git-Historie dokumentiert.

## mQorva r1 – in Arbeit

OpenCode-Basis: `1.18.18` (`e23586af2623f1bc2e8e6965d2d7acf7bd03d5c3`)

### Oberfläche

- Codex-ähnliche Desktop-Shell mit gruppierter Projekt- und Sitzungsnavigation
- getrennt ein- und ausklappbare linke Seitenleiste, rechter Arbeitsbereich und unteres Terminal
- auf die drei Arbeitsbereiche abgestimmte Kopfzeile ohne zusätzliche Sitzungs-Tabs
- einheitlichere Panel-Schalter und Größensteuerung der Arbeitsbereiche
- OpenCode-Farbschema bleibt die Quelle für Oberflächenfarben und Zustände
- Fließtext im Arbeitsbereich im dunklen Erscheinungsbild weicher; Nebentext bleibt unverändert
- dauerhaft sichtbarer Scrollbalken im Chatverlauf, durchgehend bis zur unteren Fensterkante, mit Schrittpfeilen an beiden Enden
- rechter Arbeitsbereich liegt auf derselben Fläche wie der Verlauf, getrennt durch eine Kante statt durch einen Farbsprung
- Sitzungstitel steht nur noch in der Kopfzeile; das zugehörige Menü sitzt dort statt in einer zweiten Zeile im Verlauf
- Kontextmenüs der Seitenleiste in derselben Familie wie die übrige Oberfläche; Dreipunkt-Knöpfe entfallen, die rechte Maustaste übernimmt
- Schriftgrößen, -gewichte und Zeilenhöhen der Seitenleiste an die übrige Oberfläche angeglichen
- Farben des Fenstermenüs an die übrigen Menüs angeglichen
- Markdown-Dateien öffnen im Seitenpanel als gesetzte Vorschau; ein Knopf in der Tab-Leiste schaltet auf den Quelltext um
- Klick auf einen Dateipfad im Verlauf öffnet das Seitenpanel sofort und zeigt dort einen Ladezeiger, statt bis zum fertig geladenen Inhalt zu warten
- Markdown-Vorschau im Seitenpanel nutzt die Breite des Panels und wächst beim Ziehen des Griffs und beim Vergrößern des Fensters mit
- dauert das Formatieren einer großen Markdown-Datei, steht der rohe Text schon da und ein kleiner Hinweis meldet die laufende Formatierung
- Rechtsklick im Verlauf und in der Dateivorschau zeigt das Menü der Oberfläche mit deutschen Beschriftungen statt des nativen Systemmenüs; „alles markieren“ betrifft dabei den Verlauf, nicht das ganze Fenster
- native Kontextmenüs in Eingabefeldern — dort wegen Rechtschreibprüfung und Einfügen beibehalten — folgen der eingestellten Sprache
- Tabs, „öffnen mit" und der Einklapp-Knopf des Seitenpanels stehen auf einer Linie mit der Kopfzeile der Sitzung
- Sitzungsmenü sitzt direkt hinter dem Sitzungstitel statt am rechten Rand
- Kante zwischen Verlauf und Seitenbereich ist sichtbar und damit als Ziehgriff erkennbar
- Sitzungsliste ohne Zeitangabe je Eintrag; lange Titel wandern beim Zeigen einmal und bleiben stehen
- Schnellliste am linken Rand des Chatverlaufs mit einer Marke je Nutzereingabe, Vorschau beim Zeigen und Sprung per Klick
- Schnellliste mit gleichmäßigen Abständen; Marken wachsen weich unter dem Zeiger, die Vorschau zeigt die Eingabe und darunter die Antwort des Agenten
- Schnellliste blendet sich aus, sobald der Chatverlauf zu schmal oder zu niedrig wird
- Eingabefeld liegt auf einer eigenen, vom Verlauf abgesetzten Fläche
- Titelleistenfarbe reicht unter die nativen Windows-Fensterknöpfe
- Projektfarbe und -symbol aus den Projekteinstellungen werden in der Seitenleiste angezeigt
- ruhigere Sitzungszeilen: Aktionen erst beim Zeigen, laufende Sitzungen bleiben am Spinner erkennbar
- aktive Einträge werden nur noch über die Fläche hervorgehoben
- Führungslinie und kräftigere Projektzeile machen die Gruppierung lesbar
- Verlauf am oberen Rand der Sitzungsliste, eigener Scrollbalken wie im Chatverlauf, sichtbarer Ziehgriff

### Bedienung

- Projekte und Sitzungen werden über die vorhandenen OpenCode-Datenwege bedient
- neue Sitzung startet ohne Projektzuordnung im Block „Sitzungen“ und wird per Drag & Drop einem Projekt zugeordnet
- Projektauswahl verwendet im Desktop den nativen Verzeichnisdialog
- bestehende OpenCode-Bereiche für Dateien, Prüfung und Terminal bleiben angebunden
- Sitzungen lassen sich innerhalb ihres Blocks per Drag & Drop umsortieren; Ziehen in den Block „Angeheftet“ heftet an, Ziehen auf ein Projekt löst
- Suche erfasst alle Blöcke, blendet leere Gruppen aus und meldet fehlende Treffer; Escape schließt, ein Knopf leert
- Umschalter der Seitenleiste bleibt in der Titelleiste erreichbar, auch ohne geöffnetes Projekt

### Entwicklung und Wartung

- eigene mQorva-App-IDs, Produktnamen, Verknüpfungen und Datenverzeichnisse
- eigenes `opencode-mqorva://`-Protokoll ohne Übernahme des offiziellen OpenCode-Handlers
- einmalige, nicht überschreibende Übernahme vorhandener Dev-Einstellungen
- offizieller OpenCode-Updater in der mQorva Edition deaktiviert; Updates erfolgen über geprüfte Upstream-Merges
- lokale Build-, Paket-, Prüf- und Synchronisationsskripte für Windows
- zusätzliche mQorva-Versionsmetadaten und nachvollziehbare Installerbezeichnungen

### Noch offen

- vollständige visuelle Abnahme aller Zustände und Fenstergrößen
- vollständige Funktionsabnahme sämtlicher Projekt- und Sitzungs-Kontextaktionen
- Aktualisierung der technischen Patchliste nach Abschluss der laufenden UI-Revision
