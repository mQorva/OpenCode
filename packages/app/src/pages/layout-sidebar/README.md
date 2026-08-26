# Codex-ähnliche Sidebar-Ansicht

Diese Ansicht ersetzt nur die Arbeitsoberfläche von OpenCode. Server, Sitzungen, Projekte,
Dateien, Terminal und Einstellungen bleiben OpenCode-Funktionen.

## Aufbau

- Die obere App-Leiste enthält den Umschalter der linken Seitenleiste. Er bleibt auf derselben
  Zeile wie das Anwendungsmenü und die Fenstersteuerung.
- Die linke Leiste gruppiert Chats nach OpenCode-Projekt und führt oben einen separaten Block
  „Chats“ für Einträge außerhalb aller Projekte. Ihre Breite ist ziehbar und wird im
  bestehenden Layout-Speicher gesichert.
- Der zentrale Bereich ist der Chat. In einem neuen Chat wird das Projekt allein über die linke
  Leiste bestimmt; der Composer zeigt keinen zweiten Projektwähler.
- In einer aktiven Session liegen Terminal, Dateien und Prüfung oben rechts. Der rechte Bereich
  nutzt den bestehenden `SessionSidePanel`; das Terminal wird darunter über die volle
  Arbeitsbreite angezeigt und behält seine gespeicherte Höhe.

## Aktionen

- „Neuer Chat“ erzeugt einen OpenCode-Entwurf ohne Projektzuordnung im Block „Chats“. Per
  Drag & Drop lässt sich der Entwurf einem Projekt zuordnen; bis dahin läuft die erste Nachricht
  im Server-Arbeitsverzeichnis. Bereits gestartete Sitzungen bleiben an ihr Verzeichnis
  gebunden und sind nicht verschiebbar.
- Sitzungen, deren Verzeichnis zu keinem geöffneten Projekt gehört, erscheinen ebenfalls im
  Block „Chats“.
- „Projekt öffnen“ verwendet den bestehenden Verzeichnisauswahldialog.
- Das Projekt-Kontextmenü erstellt Chats oder entfernt das Projekt nur aus der OpenCode-Liste;
  es löscht kein Verzeichnis.
- Sitzungsarchivierung oder -löschung dürfen ausschließlich die vorhandenen OpenCode-APIs und
  deren Bestätigungsdialoge verwenden.

## Wartungsgrenze

`upstream.ts` ist der einzige Importübergang zu gemeinsam genutzten OpenCode-Komponenten. Neue
Bedienlogik soll dort bestehende UI- und Layout-APIs weiterverwenden, statt parallele Zustände
anzulegen.

## Entwicklungsregel (mQorva)

Dieser Ordner ist der **mQorva-Entwicklungszweig** im neuen Design (`layoutMode === "sidebar"`).
Es gelten die Regeln aus der Repository-`AGENTS.md` (Abschnitt „mQorva UI Development"):

- Neue mQorva-Funktionen werden **nur** hier (und in `settings-v2`, `prompt-input-v2`,
  den `newLayoutDesigns() === true`-Zweigen) gebaut.
- Das klassische Interface (`newLayoutDesigns === false`) bleibt OpenCode-kompatibel und erhält
  keine mQorva-eigenen Features. Kleine, nicht-brechende Fixes dürfen es berühren.
- Übergreifende Features (z. B. Titel-Platzhalter, Warteschlange) werden nicht zweigeteilt
  gesperrt; sie können beide Pfade betreffen.
- Der Umschalter `layoutMode` (tabs ↔ sidebar) bleibt aktiv; der Tab-Modus ist der
  Upstream-Standard.
