# Projektwechsel für laufende Sessions

Stand: 2026-09-04, überarbeitet nach Code-Prüfung. Ausgelagert aus `plans/startzeit-desktop.md` —
dort geht es um Startzeit, hier um Funktionalität.

## Entscheidung

- **Zuschnitt:** die vorhandene `MoveSession`-Mechanik projektübergreifend öffnen.
- **Ziel:** erst upstream (`anomalyco/opencode`) anfragen, bevor im Fork gebaut wird.

## Problem

Eine Session ist nach dem ersten Prompt dauerhaft an ihr Verzeichnis gebunden. In der
Oberfläche gibt es keinen Weg, sie einem anderen Projekt zuzuordnen.

Anwendungsfälle:

- Man fängt an und merkt erst dann, dass man im falschen Projekt sitzt.
- Man arbeitet projektübergreifend mit Vollzugriff und ist faktisch längst in einem anderen
  Projekt, kann die Session aber nicht dorthin verschieben.
- Ein Chat wurde ohne Projekt begonnen, ist nach dem ersten Prompt aber im `global`-Projekt
  mit `worktree: "/"` gefangen.

## Was bereits existiert

Der ursprüngliche Plan ging von einem Neubau aus. Das ist falsch — der Server kann Sessions
schon verschieben:

- `core/src/control-plane/move-session.ts` — vollständiger Umzug: Ziel auflösen, optional die
  nicht-committeten Änderungen als Git-Patch mitnehmen (`moveChanges`), `SessionEvent.Moved`
  publizieren, Quelle zurücksetzen.
- `core/src/session/projector.ts:243` — der Projector setzt daraufhin `directory`, `path` und
  `workspace_id` der Session um.
- `opencode/src/server/routes/instance/httpapi/groups/control-plane.ts:22` — der Endpunkt
  `POST .../move-session` ist bereits offen, als *experimental* markiert.

Es fehlt genau zweierlei:

1. **Kein UI-Aufrufer.** In `packages/app` ruft nichts `moveSession` auf.
2. **Die Projekt-Sperre.** `move-session.ts:83` bricht mit `DestinationProjectMismatchError` ab,
   sobald `current.projectID !== destination.id`. Heute sind also nur Umzüge *innerhalb*
   desselben Projekts möglich (Worktrees, Unterverzeichnisse) — genau der gesuchte Fall ist
   ausgeschlossen.

## Korrektur zweier Annahmen des alten Plans

**„Nur die Zuordnung ändern" ist nicht die billigere Variante.** Die Session-Daten liegen in
einer *globalen* `opencode.db` (`core/src/database/database.ts:53`), und die Route lautet
`server/<key>/session/<id>` — das Verzeichnis stammt aus dem Session-Datensatz, nicht aus der
URL. Ändert man `directory`, läuft die Session danach automatisch im neuen Projekt weiter.
Eine Trennung von Anzeigeprojekt und Arbeitsverzeichnis wäre der *teurere* Umbau, weil sie ein
zweites Feld durch Schema, Events, Projector und Oberfläche ziehen müsste.

**Die Historie ist kein Problem.** Nachrichten und Tool-Aufrufe bleiben unverändert stehen;
`Moved` fasst sie nicht an. Es wird nichts umgeschrieben.

## Was noch zu bauen ist

1. **Cross-Projekt-Variante in `move-session.ts`.** Die `projectID`-Prüfung nicht ersatzlos
   streichen, sondern als bewusste Option führen — ein Umzug in ein fremdes Projekt ist etwas
   anderes als ein Worktree-Wechsel und muss vom Aufrufer explizit verlangt werden.
2. **`project_id` ins `Moved`-Event.** Der Projector setzt heute nur `directory`, `path` und
   `workspace_id`. Ohne `project_id` bliebe die Session in der Seitenleiste beim alten Projekt.
3. **Sperre bei laufender Session.** `moveSession` prüft heute nicht, ob gerade ein Prompt
   läuft. Ein Umzug muss in dem Fall abgelehnt werden.
4. **Snapshots.** `MoveSession` behandelt nur Git-Änderungen, nicht Snapshots. Nach einem
   projektübergreifenden Umzug zeigen sie auf das alte Repo — Revert und Diff können dann
   fehlschlagen. Entscheidung: verwerfen, nicht mitnehmen; der Nutzer wird darauf hingewiesen.
5. **`moveChanges` bei Projektwechsel.** Nicht-committete Änderungen in ein fremdes Repo zu
   patchen ist fast immer falsch. Für den Cross-Projekt-Fall auf `false` festnageln.
6. **Oberfläche.** Die Sperre in `app/src/pages/layout-sidebar/sidebar.tsx:696` fällt für nicht
   laufende Sessions; das Drag-and-Drop, das heute nur Drafts bewegt, ruft dann `moveSession`.

## Abgrenzung

Ob Sessions überhaupt projektlos sein dürfen, ist eine Grundsatzentscheidung des
OpenCode-Basis-Codes. Claude Code lässt die letzte Session projektlos, Codex verlangt beim
Start eine Projektauswahl. Beide Modelle sind vertretbar; die Frage gehört upstream und wird
hier nicht entschieden. Dieser Plan setzt den heutigen Stand voraus.

## Nächster Schritt

Issue bei `anomalyco/opencode`: `MoveSession` ist als experimental markiert und die
`projectID`-Sperre wirkt bewusst gesetzt. Vor einer Fork-Lösung klären, ob ein
projektübergreifender Umzug dort gewollt ist und welche Annahmen hinter der Sperre stehen.
