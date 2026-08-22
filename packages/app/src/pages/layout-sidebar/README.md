# Codex-ähnliche Sidebar-Ansicht

Diese Ansicht ersetzt nur die Arbeitsoberfläche von OpenCode. Server, Sitzungen, Projekte,
Dateien, Terminal und Einstellungen bleiben OpenCode-Funktionen.

## Aufbau

- Die obere App-Leiste enthält den Umschalter der linken Seitenleiste. Er bleibt auf derselben
  Zeile wie das Anwendungsmenü und die Fenstersteuerung.
- Die linke Leiste gruppiert Chats nach OpenCode-Projekt. Ihre Breite ist ziehbar und wird im
  bestehenden Layout-Speicher gesichert.
- Der zentrale Bereich ist der Chat. In einem neuen Chat wird das Projekt allein über die linke
  Leiste bestimmt; der Composer zeigt keinen zweiten Projektwähler.
- In einer aktiven Session liegen Terminal, Dateien und Prüfung oben rechts. Der rechte Bereich
  nutzt den bestehenden `SessionSidePanel`; das Terminal wird darunter über die volle
  Arbeitsbreite angezeigt und behält seine gespeicherte Höhe.

## Aktionen

- „Neuer Chat“ erzeugt einen vorhandenen OpenCode-Entwurf im ausgewählten Projekt.
- „Projekt öffnen“ verwendet den bestehenden Verzeichnisauswahldialog.
- Das Projekt-Kontextmenü erstellt Chats oder entfernt das Projekt nur aus der OpenCode-Liste;
  es löscht kein Verzeichnis.
- Sitzungsarchivierung oder -löschung dürfen ausschließlich die vorhandenen OpenCode-APIs und
  deren Bestätigungsdialoge verwenden.

## Wartungsgrenze

`upstream.ts` ist der einzige Importübergang zu gemeinsam genutzten OpenCode-Komponenten. Neue
Bedienlogik soll dort bestehende UI- und Layout-APIs weiterverwenden, statt parallele Zustände
anzulegen.
