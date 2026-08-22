# Änderungen der mQorva Edition

Dieses Änderungsprotokoll enthält ausschließlich Anpassungen der mQorva Edition. Änderungen des
OpenCode-Upstreams werden weiterhin durch dessen Versionsstand und Git-Historie dokumentiert.

## mQorva r1 – in Arbeit

OpenCode-Basis: `1.18.18` (`e23586af2623f1bc2e8e6965d2d7acf7bd03d5c3`)

### Oberfläche

- Codex-ähnliche Desktop-Shell mit gruppierter Projekt- und Chatnavigation
- getrennt ein- und ausklappbare linke Seitenleiste, rechter Arbeitsbereich und unteres Terminal
- auf die drei Arbeitsbereiche abgestimmte Kopfzeile ohne zusätzliche Sitzungs-Tabs
- einheitlichere Panel-Schalter und Größensteuerung der Arbeitsbereiche
- OpenCode-Farbschema bleibt die Quelle für Oberflächenfarben und Zustände

### Bedienung

- Projekte und Chats werden über die vorhandenen OpenCode-Datenwege bedient
- neuer Chat verwendet das in der linken Seitenleiste gewählte Projekt
- Projektauswahl verwendet im Desktop den nativen Verzeichnisdialog
- bestehende OpenCode-Bereiche für Dateien, Prüfung und Terminal bleiben angebunden

### Entwicklung und Wartung

- eigene mQorva-App-IDs, Produktnamen, Verknüpfungen und Datenverzeichnisse
- eigenes `opencode-mqorva://`-Protokoll ohne Übernahme des offiziellen OpenCode-Handlers
- einmalige, nicht überschreibende Übernahme vorhandener Dev-Einstellungen
- offizieller OpenCode-Updater in der mQorva Edition deaktiviert; Updates erfolgen über geprüfte Upstream-Merges
- lokale Build-, Paket-, Prüf- und Synchronisationsskripte für Windows
- zusätzliche mQorva-Versionsmetadaten und nachvollziehbare Installerbezeichnungen

### Noch offen

- vollständige visuelle Abnahme aller Zustände und Fenstergrößen
- vollständige Funktionsabnahme sämtlicher Projekt- und Chat-Kontextaktionen
- Aktualisierung der technischen Patchliste nach Abschluss der laufenden UI-Revision
