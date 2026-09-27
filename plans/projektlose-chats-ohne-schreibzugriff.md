# Plan: Projektlose Chats ohne Schreibzugriff

Stand: 2026-09-19, nach Code-Prüfung und Kurzung des Entwurfs (keine
Mode-Gliederung mehr; Stufe `chat` verweigert auch den Lesezugriff). Ergänzt
`plans/berechtigungsstufen-pro-session.md` (dreistufige Freigabe ist gebaut) und
`plans/session-projektwechsel.md` (Cross-Projekt-`MoveSession` ist gebaut).

## Idee

Im Seitenleisten-Layout projektlos arbeiten: „Neuer Chat" legt einen Entwurf an, der zu
keinem Projekt gehört. In der Freigabe (Stufen-Select im Composer) kommt dazu die
vierte Stufe **ohne Schreibzugriff** — ein Chat, der eigentlich nichts kann: keine
Dateien, keine Befehle, kein Netz. Es gibt in dem Modus keine einzige
Genehmigungsanfrage, weil nichts mehr nachgefragt wird. Für alles andere braucht es
Ordner, also ein Projekt; einen Chat verschiebt man per Drag & Drop in ein Projekt, wo
er mit einer anderen Stufe weiterläuft.

## Ist-Stand (vorhanden, nicht neu zu bauen)

- **Stufen pro Session.** `PermissionV1.Level = ["ask", "workspace", "full"]`
  (`packages/schema/src/v1/permission.ts:30`), Stufenregeln V1
  (`packages/opencode/src/permission/level.ts`) und V2 (`levelRules` in
  `packages/core/src/permission.ts:106`), Session-Feld `permission_level`,
  Client-Persistenz (`packages/app/src/context/local.tsx:297-336`), Select im Composer
  (`packages/app/src/components/prompt-input-v2.tsx:401-410`),
  Icons/Listen-Einträge (`packages/session-ui/src/v2/components/prompt-input/index.tsx:505-511`).
- **Block „Chats"** in der Sidebar zeigt unassigned Drafts plus `chatSessions` — Sessions,
  deren Verzeichnis zu keinem geöffneten Projekt gehört
  (`packages/app/src/pages/layout-sidebar/sidebar.tsx:1026-1064`,
  `sidebar-data.tsx:176-213`). Er rendert nur, wenn Inhalt da ist.
- **Unassigned Drafts.** `DraftTab.unassigned` (`packages/app/src/context/tabs.tsx:29-31`),
  `unassignedDrafts` / `moveDraftTarget`
  (`packages/app/src/pages/layout-sidebar/sessions.ts:84-92`) — aber **kein
  Produktcode-Einstiegspunkt**, der unassigned Drafts anlegt.
- **Verschieben.** Cross-Projekt-Umzug `MoveSession` mit `allowProjectChange`
  (`packages/core/src/control-plane/move-session.ts`) plus Sidebar-Aufruf
  `moveSessionToProject` (`sidebar.tsx:811-843`); Drafts per Drag & Drop via
  `moveDraftTarget`. Chat → Projekt funktioniert also heute schon für gestartete Sessions.
- **Deny versteckt Tools.** V1 filtert `resolveTools` die Tool-Liste gegen die gemergten
  Session-Regeln (`packages/opencode/src/session/llm/request.ts:207-213`,
  `Permission.disabled`). V2 macht dasselbe in `ToolRegistry.materialize`
  (`packages/core/src/tool/registry.ts:106-135`), der Runner übergibt aber nur die
  **Agenten**-Regeln (`packages/core/src/session/runner/llm.ts:271`) — die Stufenregeln
  fehlen dort.

## Entscheidungen

1. **Neue Stufe `chat`, Label „nur Chat" / „Chat only".** Keine eigene Session-Art:
   `permissionLevel` reist schon über create, update und Persistenz — es braucht genau
   ein Schema-Literal, die Regeln und einen UI-Eintrag. Der Select zeigt alle vier
   Stufen für jede Session; `chat` ist keine Projekt-Eigenschaft und keine
   Kontext-Sonderform, sondern eine Session-Stufe wie die anderen.
2. **Regeln von `chat`: kein Zugriff, nur Antwort.** Die Stufe verweigert jede
   Datei-, Shell- und Netz-Kapazität; angehängt nach den Agentenregeln
   (`findLast` entscheidet):

   | Aktion | Effekt | Begründung |
   | --- | --- | --- |
   | `edit` (deckt edit, write, apply_patch ab) | `deny *` | kein Schreibzugriff |
   | `bash` | `deny *` | keine Befehle |
   | `read`, `grep`, `glob`, `list`, `lsp` | `deny *` | **kein Datei-Zugriff** — nicht mal lesen; für Dateien braucht es ein Projekt |
   | `webfetch`, `websearch` | `deny *` | kein Netz |
   | `skill` | `deny *` | Skill-Loads lesen SKILL.md und eine Datei-Liste (`core/src/tool/skill.ts:76-91`) — anders läge Datei-Zugriff über die Skill-Naschroute offen |
   | `task` | `deny *` | Subagents würden die Stufe erben (`task.ts:162`) und sind in einem toolfreien Chat ohnehin zwecklos |
   | `todowrite` | `deny *` | kein Task-Tracking, kein Werkzeug |
   | `external_directory` | `deny *` | Abriegelung nach außen (in sich redundant, hält die Garantie aber nachvollziehbar) |
   | `doom_loop` | `deny *` | die V1-Doom-Loop-Rückfrage (Agentenregel `ask`) wird nicht zum Dialog |

   Etwas bleibt: **`question`** (Agentenentscheid, beim Build-Agent erlaubt) — der
   Interdialog zwischen Modell und Nutzer ist der Punkt eines Chats, und das
   Question-Dock ist keine Genehmigung. **Konsequenz:** Es kann in dieser Stufe keine
   Genehmigungsanfrage mehr entstehen — jede `ask`-Quelle des Default-Regelwerks
   (externes Verzeichnis, `.env`, Doom-Loop) ist gedenyt, und gedenyte Aktionen
   schlagen still fehl, statt nachzufragen. Gespeicherte Projekt-Freigaben können nur
   `allow` beitragen, nie `ask` — die Garantie bleibt auch dort bestehen.
3. **Tools verschwinden aus dem Tool-Set.** Der V2-Runner materialisiert ab sofort mit
   dem vollständigen Session-Regelwerk (Agent + Stufe), nicht nur mit den
   Agentenregeln (Punkt 4 unten). Auf den drei bisherigen Stufen ändert das nichts
   (die liefern keine `deny`-Regeln); bei `chat` sehen die Modelle die Tools gar
   nicht und versuchen es nicht — statt Tool-Fehler in den Transkripten bleibt der
   Chat reine Unterhaltung. V1 braucht keinen Eingriff: `resolveTools` mergt die
   Session-Regeln bereits.
4. **Projektloser Chat = unassigned Draft im Server-Arbeitsverzeichnis.**
   `serverSync().data.path.directory || path.home` — derselbe Wert, den `chatSessions`
   (V2: globaler Session-Index) und `chatLocations` (V1: per-Verzeichnis-Store) bereits
   als „außerhalb aller Projekte" verstehen. Kein virtueller Ort, kein neues Schema:
   eine Session braucht einen Ort, und das Server-Arbeitsverzeichnis ist der
   projektlose Ort. Der erste Prompt legt die Session dort an (Mechanismus in
   `packages/app/src/components/prompt-input/submit.ts:375-441` unverändert).
5. **Default-Stufe für unassigned Drafts: `chat`.** Assigned Drafts und neue Projekt-
   Chats bleiben bei „die letzte Entscheidung" (Default `workspace`). Eine manuelle
   Auswahl im Composer überschreibt den Default sofort.
6. **Level bleibt beim Verschieben erhalten.** Die Stufe ist Session-Zustand, keine
   Projekteigenschaft. Ein Chat, der in ein Projekt wandert, bleibt dort `chat`, bis
   der Nutzer im Composer eine andere Stufe wählt — sichtbar, weil der Select den
   aktuellen Wert zeigt, nicht still.

## Was gebaut wird

### 1. Stufe `chat` — Schema und Regeln

- `packages/schema/src/v1/permission.ts:30` — `Level` um `"chat"` erweitern (V2 nutzt
  denselben Typ).
- `packages/opencode/src/permission/level.ts` — `rules()` um den `chat`-Zweig (Tabelle
  oben, V1-Form `{ permission, pattern, action: "deny" }`, Shell-Tool über
  `ShellID.ToolID`).
- `packages/core/src/permission.ts` — `levelRules()` um denselben Zweig in V2-Form
  `{ action, resource, effect: "deny" }`; Kommentar wie bei `full`: Die Regeln werden
  *nach* den Agentenregeln angehängt, deshalb übersteuert die Stufe jede `ask`-Quelle
  der Agenten- und User-Konfiguration, und `doom_loop` ist bewusst dabei (V1 liest den
  Doom-Loop-Pfad aus den Agentenregeln, die Regel fixiert die Absicht fürs Session-
  Regelwerk).
- `packages/core/src/session/runner/llm.ts:271` — `tools.materialize(
  PermissionV2.merge(agent.permissions, levelRules(session.permissionLevel, agent.permissions)))`.
  Die Session steht im Runner (`store.get`); `sessionApproved` kann draußen bleiben,
  weil es nur `allow` beisteuern kann und kein Tool verstecken muss.
- Regenerierung: `bun run generate` in `packages/client` (AGENTS.md); legacy JS-SDK bei
  Bedarf via `./packages/sdk/js/script/build.ts`.

### 2. Stufe `chat` — Client

- `packages/app/src/components/prompt-input-v2.tsx:403` — Tupel um `"chat"` erweitern.
- `packages/ui/src/i18n/en.ts` / `de.ts` — neue Keys (daneben die drei Bestehenden):

  ```
  "ui.promptInput.permission.chat": "Chat only"
  "ui.promptInput.permission.chat.description":
    "No files, no commands, no network. The session only answers and can ask you questions."
  "ui.promptInput.permission.chat" (de): "nur Chat"
  "ui.promptInput.permission.chat.description" (de):
    "Keine Dateien, keine Befehle, kein Netz. Die Sitzung kann nur antworten — und Fragen stellen."
  ```

- `packages/ui/src/v2/components/icon.tsx` — ein neues 16×16-Icon
  (`stroke="currentColor"`), vorbild `shield-lock` (Schild + Schlüsselloch);
  Abbildung in `permissionIcon()` in
  `packages/session-ui/src/v2/components/prompt-input/index.tsx:507` (`chat → shield-lock`).
- `packages/app/src/context/local.tsx` — `resolvePermission()`: Für Drafts (kein
  `params.id`) das aktuelle Draft-Tab (`useTabs` + Query `draftId`) prüfen; bei
  `unassigned === true` liefert der Default `"chat"` statt
  `saved.permission ?? DEFAULT_PERMISSION_LEVEL`. Explizite Auswahl (Draft-State über
  `write()`) gewinnt weiterhin.

### 3. Projektloser Chat — Sidebar

- `packages/app/src/pages/layout-sidebar/sidebar.tsx` — die Kopfzeile „Chats" wird
  **dauerhaft** sichtbar (heute nur mit Inhalt, Z. 1026-1064) und bekommt rechts ein
  `+`, gebaut wie die Projekt-Kopfzeile (Z. 1105-1116):

  ```ts
  const workingDirectory = () => serverSync().data.path.directory || serverSync().data.path.home
  const newProjectlessChat = () =>
    void tabs.newDraft({ server: server.key, directory: workingDirectory(), unassigned: true })
  ```

  Label über `command.session.new` („neue Sitzung"). Beide Werte leer → Button
  deaktiviert (kein Server-Arbeitsverzeichnis auflösbar).
- `packages/app/src/components/titlebar.tsx` — `openNewTab` (mod+t): Wenn keine Projekte
  offen sind, bricht der Ablauf heute mit `if (!fallback) return` ab (Z. 316-323). Im
  Seitenleisten-Layout wird dieser Fall auf den projektlosen Chat umgebogen — dasselbe
  `newDraft` mit `unassigned: true`. Mit offenen Projekten ändert sich nichts.
- Tests: `layout-mode.test.ts` / `sessions.test.ts` um die neuen Fallkombinationen
  (unassigned Draft im Chats-Block, Kopfzeile ohne Inhalt).

### 4. Verschieben (bestehende Wege, ergänzt)

- **Chat → Projekt:** funktioniert bereits (Drag auf Projektgruppe, `moveSessionToProject`
  mit `allowProjectChange: true`; Drafts via `moveDraftTarget`).
- **Projekt → Chat (optional):** eine idle Session auf die Chats-Kopfzeile legen
  führt `moveSession` ins Arbeitsverzeichnis aus (`allowProjectChange: true`); die
  Session wandert in den Chats-Block. Umsetzung: `moveSessionToProject` zu
  „verzeichniseutigem Umzug" verallgemeinern (Ziel = Arbeitsverzeichnis statt
  Worktree). Das gegenläufige Drag-Ziel in `canDropSession` / `onDragEnd` ergänzen.

## Phasen

1. **Stufe `chat` (Backend + Client):** Schema-Literal, `levelRules`/`rules`,
   Runner-`materialize`, SDK-Regenerierung, Select-Option, i18n (`en` + `de`), Icon,
   Default für unassigned Drafts in `local.tsx`. Unit-Tests: V1 `permission/`-Tests und
   V2 `packages/core/test/permission.test.ts` — `chat` liefert die Deny-Regeln,
   `chat` + Agent `plan` kann weiterhin nichts schreiben, im Default-Regelwerk bleibt
   nach der Stufe kein `ask` mehr zurück, `full`-Semantik unverändert.
2. **Projektlose Chats (Sidebar):** Chats-Kopfzeile dauerhaft mit `+`, mod+t-Fallback,
   unassigned Draft im Arbeitsverzeichnis, Tests der Sidebar-Logik.
3. **Manuelle Verifikation** (Liste unten), `CHANGELOG.mqorva.md`.
4. **Optional:** Projekt → Chat als Drag-Ziel.

## Verifikation

1. App ohne Projekt starten → „Chats"-Kopfzeile mit `+` → „neue Sitzung" öffnet einen
   unassigned Draft; im Composer steht „nur Chat" vorausgewählt.
2. Erster Prompt: Session entsteht im Server-Arbeitsverzeichnis, erscheint im
   Chats-Block; die Session-Row trägt `permission_level = chat`.
3. In der Chat-Session: Datei lesen/ändern, Shell-Befehl und Webfetch anfordern → die
   Tools stehen nicht im Tool-Set (Runner-Log/Debug-Output), es erscheint **kein**
   Permission-Dock, keine Systembenachrichtigung, keine Sidebar-Aufmerksamkeit
   „permission". Reine Unterhaltung läuft normal; das `question`-Tool darf ein
   Question-Dock erzeugen (Gespräch, keine Genehmigung).
4. Agent `plan` in der Chat-Session: weiterhin keine Schreibcapability; Agent `explore`
   durch die Stufe nicht schwächer als ohne.
5. Chat per Drag in ein offenes Projekt: Session wandert in die Projektgruppe,
   Transkript unverändert, Stufe zeigt „nur Chat" weiter an; im Composer auf
   `workspace` stellen → Coding läuft, Freigaben wie gewohnt.
6. Regressions-Garantie: Stufen `ask`/`workspace`/`full` verhalten sich exakt wie zuvor
   (Tool-Listen vor/nach dem `materialize`-Change vergleichen — die liefern keine
   `deny`-Regeln, also keine sichtbare Änderung).
7. Persistenz: Stufe `chat` → Reload → erhalten; Server-Neustart → erhalten; Subagent
   (`task`) ist in einer `chat`-Session nicht ladbar (Deny); neue Projekt-Session
   startet weiterhin bei `saved.permission ?? workspace`.
8. `bun run generate` (`packages/client`), danach `bun typecheck` in `packages/core`,
   `packages/opencode`, `packages/app`, `packages/session-ui`, `packages/ui`.
9. Laut `packages/app/AGENTS.md`: Benchmark-Baseline der Session-Darstellung vor dem
   Runner-Change aufzeichnen und danach vergleichen.

## Out of Scope

- Klassisches Layout (V1-Pfad) und TUI: bleiben OpenCode-kompatibel bzw. haben eigene
  Berechtigungs-UX.
- Echte „keine-Ort"-Sessions (virtueller Location): Chats laufen im
  Server-Arbeitsverzeichnis, so wie die bestehende `chatSessions`/`chatLocations`-
  Mechanik es voraussetzt.
- Automatische Projektzuordnung (Chat „lernt" sein Projekt aus dem Gespräch).
- Snapshots/Revert für `chat`-Sessions: ohne Schreibzugriff entstehen keine Snapshots.
