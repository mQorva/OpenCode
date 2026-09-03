# Plan: Berechtigungsstufen pro Session

## Ist-Stand (recherchiert)

### OpenCodes Default-Regelwerk

`packages/opencode/src/agent/agent.ts:119-136` — der `defaults`-Regelsatz, den jeder
Agent erbt:

```
"*":                 "allow"
read:                { "*": "allow", "*.env": "ask", "*.env.*": "ask", "*.env.example": "allow" }
external_directory:  { "*": "ask", <Truncate-Glob, tmp, Skill-Dirs, Reference-Dirs>: "allow" }
doom_loop:           "ask"
question:            "deny"   (im build-Agent auf "allow" gehoben)
plan_enter/plan_exit: "deny"  (im build-Agent plan_enter "allow")
```

**Standardmäßig ist alles erlaubt.** Nachgefragt wird nur bei

1. Zugriffen **außerhalb des Workspace** (`external_directory`),
2. Lesen von `.env`-Dateien,
3. Doom-Loop-Erkennung.

Der Default *ist* also bereits „Workspace, außerhalb wird gefragt" — er wird zur
mittleren Stufe. Ein Modus, der auch im Workspace nachfragt, existiert heute nicht
und kommt neu dazu.

Der `plan`-Agent (Z. 153-176) ist OpenCodes eigene Read-only-Definition:
`edit: { "*": "deny" }`, `task.general: "deny"`, `plan_exit: "allow"` — **`bash`
bleibt dort erlaubt.**

### Der bestehende Schalter ist bereits sessionbezogen

`packages/app/src/context/permission-auto-respond.ts:3-6` legt den Auto-Accept-Wert
unter `acceptKey(sessionID, directory)` ab, und `createPermissionScopeController`
(`settings-v2/general-controllers.ts:25-49`) übergibt die aktuelle `sessionID`. Der
Schalter wirkt **schon heute pro Session**; er sieht nur global aus, weil er in den
Einstellungen steht.

Mechanisch ist er etwas anderes als eine Regel: Das Backend fragt weiterhin, der
Client beantwortet den Dialog nur automatisch.

## Stufenmodell (3 Stufen)

Die drei Stufen sind eine Skala **einer** Frage: wie viel wird nachgefragt? Jede
Stufe fragt weniger als die vorige.

| id     | Label (DE)     | Fragt nach bei |
| ------ | -------------- | -------------- |
| `ask`  | „nachfragen"   | jedem Schreibzugriff (`edit`/`write`/`apply_patch`), jedem Shell-Befehl außer reinen Verzeichniswechseln, jedem Netzzugriff (`webfetch`/`websearch`) — zusätzlich zu allem, was `workspace` schon fragt. |
| `workspace` | „Workspace"    | Zugriffen außerhalb des Workspace und `.env`-Reads. Exakt OpenCodes heutiges Verhalten, kein zusätzliches Regelwerk. |
| `full` | „Vollzugriff"  | nichts. Jede `ask`-Regel des Session-Regelwerks wird zu `allow`; `deny`-Regeln bleiben. |

Lesende Werkzeuge (`read`, `grep`, `glob`, `list`, `lsp`) fragen in keiner Stufe.

`workspace` ist der heutige Zustand und damit die Regressionsgarantie: wer die Stufe nie
anfasst, merkt keinen Unterschied.

### Warum es keine „Schreibschutz"-Stufe gibt

Naheliegend wäre eine Stufe, die Schreiben nicht *erfragt*, sondern *verbietet*
(`edit: "*" = deny`, wie im `plan`-Agent). Sie gehört aber auf eine andere Achse:

- Der **Agent** bestimmt, *was* getan wird — `plan` plant, `build` baut. Dafür gibt
  es den Agent-Select direkt daneben, und `plan` ist genau dieser Schreibschutz.
- Die **Stufe** bestimmt, *wie viel gefragt* wird.

Beides in einen Regler zu packen erzeugt Widersprüche — „Agent `plan` + Vollzugriff"
wäre sonst eine Kombination, deren Auflösung eigene Sonderregeln bräuchte.

Der Preis: Bei `deny` verschwinden die Edit-Tools über `Permission.disabled()`
komplett aus dem Tool-Set, das Modell versucht es gar nicht erst. Bei `ask` versucht
es und wird gefragt. Das kostet Dialoge — aber die sind der Zweck dieser Stufe, und
„immer erlauben" im Dialog dämpft die Wiederholung sofort — beim Shell-Tool sogar
präfixweise: `shell.ts:409` bietet als `always`-Pattern den Kommando-Präfix an
(`git status *`), nicht den exakten Befehl.

### Warum `full` kein `"*": "allow"` ist

Ein pauschales `"*": "allow"` hinten am Ruleset würde auch die Regeln aushebeln, die
einen Agent überhaupt ausmachen: Bei Agent `plan` plus Stufe `full` könnte das Modell
plötzlich editieren. Stattdessen dreht `full` nur die vorhandenen `ask`-Regeln auf
`allow` (siehe Regelwerk unten) und trifft damit genau die Fälle, die den Nutzer heute
unterbrechen — `external_directory`, `.env`-Reads und alles, was die User-Config auf
`ask` setzt. `plan` und `explore` bleiben intakt; die Stufe ist orthogonal zum Agent,
eine Ausgrauung im UI ist nicht nötig.

## Backend

### 1. Regelwerk

Neues Modul `packages/opencode/src/permission/level.ts`:

```ts
export const Level = Schema.Literals(["ask", "workspace", "full"])
export function forSession(input: { agent: Agent.Info; session: Session.Info }): PermissionV1.Rule[]
```

`forSession` merged `agent.permission` + `session.permission` und hängt die
Stufenregeln **hinten** an (`evaluate` wertet per `findLast` aus — der letzte
passende Rule gewinnt):

- `workspace` → `[]`
- `ask` und `full` sind zueinander symmetrisch: sie verschieben je eine Stufe auf
  der Achse `allow → ask → deny` und lassen `deny` in beiden Richtungen unangetastet.

```ts
const ASKABLE = ["edit", ShellID.ToolID, "webfetch", "websearch"]

// ask: was heute erlaubt ist, fragt künftig nach
ASKABLE.filter((key) => evaluate(key, "*", ruleset).action === "allow")
       .map((permission) => ({ permission, pattern: "*", action: "ask" }))

// full: was heute fragt, ist künftig erlaubt — außer der Doom-Loop-Schranke
ruleset.filter((rule) => rule.action === "ask" && rule.permission !== "doom_loop")
       .map((rule) => ({ ...rule, action: "allow" }))
```

`doom_loop` ist im `full`-Filter ausgenommen: Der Doom-Loop-Pfad liest heute
`agent.permission` statt des Session-Regelwerks (siehe Abschnitt 3) und wäre damit
ohnehin unberührt — die Ausnahme hält die Absicht aber im Code fest, statt sie von
der Aufrufreihenfolge abhängig zu machen.

Der `evaluate`-Filter bei `ask` ist nicht optional: OpenCodes Regeln stehen als
`"*": "allow"` bzw. `"*": "deny"` in der Wildcard-Permission, nicht unter dem
konkreten Schlüssel. Ein blindes Anhängen von `edit: ask` würde beim `explore`-Agent
(`"*": "deny"`) dessen Sperre zur Rückfrage **aufweichen** — die Stufe erlaubte dann
mehr als der Agent. Der Filter fragt deshalb erst das geltende Regelwerk, und
erzeugt die `ask`-Regel nur dort, wo aktuell `allow` gilt.

### 2. Session-Feld

`packages/opencode/src/session/session.ts` — die Session hat bereits
`permission?: PermissionV1.Ruleset` (Z. 243, 268, 292, 423, 479-484, 781-783) plus
`setPermission`. Das Feld bleibt unverändert (programmatische Overrides via SDK,
Sub-Agent-Denies aus `task.ts:141-170`).

**Neu daneben:** `permissionLevel?: Level`. Kein abgeleitetes Ruleset in
`permission`, weil

- der HTTP-`update`-Handler additiv merged (`handlers/session.ts:194-198`) — beim
  Stufenwechsel bliebe der alte Regelsatz liegen,
- die UI die gewählte Stufe anzeigen muss, ein Ruleset aber nur rückwärts
  interpretierbar wäre.

Betroffen: Schema (Z. 243/268/292), `Patch` (Z. 479-484), `create` (Z. 510-526),
`patch` (Z. 745), Drizzle-Migration für die Spalte `permission_level`.

### 3. Auswertungsstellen

| Datei | Zeile | heute | Stufe greift |
| --- | --- | --- | --- |
| `session/tools.ts` | 87 | `merge(agent.permission, session.permission ?? [])` | ja |
| `session/llm.ts` | 149 | `merge(agent.permission ?? [], permission ?? [])` | ja |
| `session/system.ts` | 120 | `merge(agent.permission, permission ?? [])` | ja |
| `session/prompt.ts` | 346 | `merge(taskAgent.permission, session.permission ?? [])` | ja |
| `session/processor.ts` | 378 | nur `agent.permission` | **nein, absichtlich** |

Umgestellt wurden `tools.ts`, `llm.ts` und `prompt.ts`. `system.ts` und
`ToolRegistry.describeCodeMode` blieben unverändert: beide filtern über
`Permission.disabled()`, das ausschließlich `deny` auswertet — und weder `ask` noch
`full` erzeugt je ein `deny`. Die Stufe kann dort also nichts ändern.

**`processor.ts:378` bleibt wie es ist.** Der Pfad ist die Doom-Loop-Erkennung: Er
fragt, wenn das Modell dasselbe Tool dreimal hintereinander mit identischem Input
aufruft. Das ist ein Schutz gegen Endlosschleifen und verbrannte Tokens, keine
Berechtigungsfrage — deshalb darf ihn auch „Vollzugriff" nicht abschalten. Ein
Kommentar an der Stelle hält fest, dass das kein Versehen ist.

Das ist eine bewusste Verhaltensänderung gegenüber heute: der bisherige
Auto-Accept-Schalter beantwortet den Doom-Loop-Dialog automatisch mit, weil er
clientseitig alle Dialoge wegklickt. Stufe `full` tut das nicht mehr.

### 4. Sub-Sessions

`packages/opencode/src/tool/task.ts:155-170` erzeugt Child-Sessions über
`sessions.create({ parentID, permission: deriveSubagentSessionPermission(...) })`.
Dort zusätzlich `permissionLevel: parent.permissionLevel` durchreichen — die Stufe
erbt nach unten, ohne eigene Lineage-Auflösung.

### 5. API

`handlers/session.ts:194` — `update`-Payload um `permissionLevel` erweitern
(Replace-Semantik, kein Merge). Danach `bun run generate` in `packages/client`
(AGENTS.md).

## Client

### 6. Persistenz — „Default ist die letzte Entscheidung"

`packages/app/src/context/local.tsx` hält Agent/Modell/Variant pro Session im Bucket
`model-selection.v1` (Z. 19-28, 75-83). Die Stufe kommt dazu:

```ts
type State = {
  agent?: string
  model?: ModelKey
  variant?: string | null
  permission?: PermissionLevel   // neu
}
```

Optionales Feld → alte Persist-Stände lesen sich unverändert, kein Version-Bump,
keine Migration.

**Vorauswahl für neue Sessions:** identisch zur Modell-Logik. `write(...)`
(Z. 262 ff.) schreibt in die Session oder in den Draft; `local.session.promote(...)`
(`submit.ts:437-441`) überträgt den Draft beim Anlegen der Session. Zusätzlich wird
die zuletzt gewählte Stufe pro Workspace gemerkt und als Startwert für den nächsten
Draft verwendet — der Default ist damit tatsächlich „die letzte Entscheidung" und
kein fester Wert. Erst-Nutzung ohne Historie: `workspace`.

**Serverabgleich:** Beim Setzen zusätzlich `sdk().api.session.update({ sessionID,
permissionLevel })` (nur bei existierender Session); bei neuen Sessions reist die
Stufe über `session.create(...)` mit (`submit.ts:420-425`).

**Wahrheitsquelle bei Konflikt:** Session-Row gewinnt beim Laden, lokaler Persist ist
Vorauswahl — identisch zur heutigen Modell-Semantik.

### 7. UI

`packages/session-ui/src/v2/components/prompt-input/index.tsx`:

- Neue Komponente `PromptInputV2PermissionSelect` neben
  `PromptInputV2ConfiguredSelect` (Z. 475-551) als `MenuV2.RadioGroup` mit drei
  Einträgen, Trigger-Stil wie der Variant-Select.
- Platzierung in der **linken** Gruppe (Z. 206-233), nach dem Agent-Select:
  `[+] · Agent · Berechtigung | … | Modell · Variant · Senden`.
- Sichtbarkeit: `inert` im Shell-Modus, wie die Nachbarn.
- Keybind `["Shift", "Mod", "P"]` — konsistent mit dem Variant-Select
  (`["Shift", "Mod", "D"]`). Standalone frei; `mod+shift+p` existiert nur als zweiter
  Teil des Chords `mod+k,mod+shift+p` (`command.tsx:14`) und kollidiert nicht.
- Neue Prop `permissionControl` am `PromptInputV2`, durchgereicht aus
  `packages/app/src/components/prompt-input-v2.tsx` (analog `modelControl`, Z. 200-224).

### 8. Icons

`packages/ui/src/v2/components/icon.tsx` ist eine Inline-SVG-Registry mit 16
Einträgen (keine Datei-Assets, kein Schloss/Auge vorhanden). Drei neue
16×16-Pfade mit `stroke="currentColor"` ergänzen:

| Stufe  | Icon-Name      |
| ------ | -------------- |
| `ask`  | `shield-question` |
| `workspace` | `shield`     |
| `full` | `shield-off`      |

### 9. i18n

Neue Keys:

```
ui.promptInput.choosePermission
ui.promptInput.permission.ask / .description
ui.promptInput.permission.work / .description
ui.promptInput.permission.full / .description
```

**Nur `en` und `de` pflegen.** `packages/app/src/context/language.tsx:49` legt jedes
Locale über die englische Basis (`{ ...base, ...flatten(locale) }`), fehlende Keys
fallen also automatisch auf Englisch zurück. Die übrigen 60 Locales bekommen ihre
Übersetzung im regulären Übersetzungslauf.

## Aufräumen

### 10. Settings-Schalter entfernen

- `settings-v2/general.tsx` — `PermissionScopeSetting` (Z. 79-93) und die Einbindung
  (Z. 380) löschen.
- `settings-v2/general-controllers.ts` — `createPermissionScopeController`
  (Z. 25-49) samt Typ-Export löschen.
- `settings-general.tsx:319-326` (V1) — bleibt stehen. AGENTS.md: der V1-Pfad bleibt
  OpenCode-kompatibel, neue Funktionen nur im V2-Pfad.

### 11. `autoAccept` bleibt

`permission.tsx` / `permission-auto-respond.ts` bleiben unverändert. `autoAccept` ist
die Dialogantwort „für diese Session immer erlauben" und damit orthogonal: die Stufe
setzt die Grundregel, `autoAccept` beantwortet eine konkrete Anfrage.

Berührungspunkt: `submit.ts:373` (`shouldAutoAccept` aus `input.autoAccept()`) hängt
am entfallenden Settings-Schalter — Aufrufer prüfen und entfernen.

## Verifikation

1. Stufe `workspace`: Verhalten identisch zu `dev` — außerhalb des Workspace fragt es,
   `.env` fragt, sonst nicht.
2. Stufe `ask`: Datei im Workspace schreiben → Dialog. Shell-Befehl → Dialog.
   `webfetch` → Dialog. Lesen/`grep`/`glob` → kein Dialog. Agent `explore`
   (`"*": "deny"`) darf durch die Stufe nichts zusätzlich dürfen.
3. Stufe `full`: weder `external_directory` noch `.env` fragen nach. **Agent `plan`
   plus `full` kann weiterhin nicht editieren** — der zentrale Test für die
   `ask`→`allow`-Konstruktion.
4. Doom-Loop: dreimal derselbe Tool-Aufruf fragt auch auf Stufe `full` nach.
5. Persistenz: Stufe setzen → Reload → erhalten. Server neu starten → erhalten.
   Subagent starten → erbt. Neue Session → übernimmt die zuletzt gewählte Stufe.
6. `bun run generate` (`packages/client`), dann `bun typecheck` in
   `packages/opencode`, `packages/app`, `packages/session-ui`, `packages/ui`.

## Phasen

1. **Regelwerk** — `permission/level.ts`, `Permission.forSession`, die vier
   Merge-Stellen, Unit-Tests gegen `evaluate` (inkl. `plan` + `full` und
   `explore` + `ask`). Ohne Persistenz, ohne UI.
2. **Session-Feld** — Schema, Drizzle-Migration, `create`/`patch`, Vererbung in
   `task.ts`, HTTP-`update`, `bun run generate`.
3. **Client-Persistenz** — `local.tsx`-State, Serverabgleich, `submit.ts`.
4. **UI** — Komponente, Toolbar-Platzierung, Icons, i18n (`en` + `de`), Keybind.
5. **Aufräumen + Verifikation** — Settings-V2-Schalter raus, `CHANGELOG.mqorva.md`,
   Testliste oben.

## Out of Scope

- V1-Prompt-Input und V1-Settings (bleiben OpenCode-kompatibel).
- TUI (eigene Berechtigungs-UX).
- Agent-spezifische Stufen — die Stufe gilt pro Session, nicht pro Agent.
- `DialogSavedProjectPermissions` (verwaltet „always"-Antworten, orthogonal).
