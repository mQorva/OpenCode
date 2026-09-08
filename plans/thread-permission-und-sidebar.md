# Plan: Thread-Darstellung, Projekt löschen, Berechtigungen, Railbar, Chat-Eingabe

Stand: **Alle Punkte umgesetzt und verifiziert (08.09.2026)**. Typechecks grün:
`packages/app` (tsgo -b), `packages/opencode` (tsgo --noEmit), `packages/session-ui`
(tsgo --noEmit). Tests grün: `opencode/test/permission/` 98 pass/0 fail (inkl. Dedup- und
Level-Skill-Tests), `app`-Layout-/Sidebar-Tests grün.

## Bestehende PRs (zu Punkt 1 und 5)

- **Punkt 5** – es gibt einen sehr passenden upstream-PR:
  `anomalyco/opencode#42244` „fix: deduplicate identical permission prompts in same session" (OPEN). Er dedupliziert identische Berechtigungs-Anfragen (gleiche `sessionID`, `permission`, `patterns`) serverseitig in `packages/opencode/src/permission/index.ts` über eine gemeinsame `Deferred`-Instanz. Das behebt genau das „mehrere gleiche Abfragen auf einmal + Fehler, weil die andere nicht mehr relevant ist". Bisher im Fork **nicht** eingebaut (der Fork erzeugt in `ask()` weiterhin pro Aufruf eine neue `pending`-Zeile).
  → Punkt 5 basiert auf diesem PR, ggf. ergänzt um Sequenz-Anzeige.
- **Punkt 1** – es gibt **keinen** passenden PR. Nächste Kandidaten decken das Problem nicht ab:
  `#46344` (collapsible reasoning cards), `#42833` (variant overlap), `#45247` (/thinking toggle), `#43298` (prompt submit sichtbar). Keiner betrifft den ausbrechenden „Denkt nach"-Text.
  → Punkt 1 wird eigenständig als Bug-Fix CSE.

---

## Punkt 1 – „Denkt nach" ragt rechts aus dem Thread-Bereich

**Ursache:** Der Container `[data-slot="session-turn-thinking"]` in
`packages/session-ui/src/components/session-turn.css` (Z. 46–71) hat `min-width: 0`, aber **kein** `overflow`/`text-overflow`/`overflow-wrap`. Der darin enthaltene `TextReveal`-Heading (`.session-turn-thinking-heading`, Z. 66–71) hat ebenfalls keine Begrenzung. `text-reveal.css` erzwingt `white-space: nowrap` und setzt die Track-Breite aus JS hart in `px` (`text-reveal.tsx`, Z. 133). `text-shimmer.css` nutzt `white-space: pre`. Dadurch bricht ein langer Topic-/Reasoning-Text nicht um und bricht nicht ab.

**Fix (eigenständig, gilt für beide Pfade über die gemeinsame `session-turn.css`):**
1. `.session-turn-thinking-heading` mit `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` begrenzen.
2. Da `TextReveal` die Breite in `px` setzt, zusätzlich den Truncate-Pfad nutzen: Heading mit `data-truncate="true"` rendern (vgl. `text-reveal.css` Z. 122–138) oder die Breitenlogik so ändern, dass die Breite auf den verfügbaren Platz der Flex-Zeile begrenzt wird.
3. Zur Kontrolle `.session-turn-thinking`-Container-Klasse analog herstellen.

**Dateien:** `packages/session-ui/src/components/session-turn.css`, `packages/session-ui/src/components/session-turn.tsx`, ggf. `packages/ui/src/components/text-reveal.css` / `.tsx`.

---

## Punkt 2 + 3 – Projekt löschen löscht Sessions nicht; gelöschtes Projekt kommt zurück

**Ursache (beide Punkte, dieselbe Wurzel):** Die „Löschung" im Sidebar ist **rein clientseitig**:
- `packages/app/src/context/server.tsx` `close()` (Z. 112–122) / `remove()` (Z. 87–93) entfernen nur den Eintrag aus dem localStorage-`store.projects` und schreiben das Verzeichnis in `recentlyClosed`. **Es gibt keinen Server-Endpunkt.**
- Die Server-Persistenz ist SQLite `opencode.db` (`packages/core/src/database/database.ts`, Z. 43–55). Dort existieren Project- und Session-Zeilen weiter. Beim Start holen Boot-/Restore-Pfade (`projects.open(...)` in `packages/app/src/pages/layout.tsx` Z. 488–504, 1121–1124 u. a.) das Projekt wieder herein → Punkt 3.
- Die übrig gebliebenen Sessions erscheinen als unassigned-Chats oben, weil die Sidebar nur Sessions unter „offenen" Projekten gruppiert (`packages/app/src/pages/layout-sidebar/sidebar-data.tsx` Z. 142–149, 176–213).

**Wichtig:** Die DB ist bereits so gebaut, dass ein echtes `DELETE FROM project` per FK-Cascade alle Sessions, Messages, Parts, Todos, Workspaces und ProjectDirectories automatisch mitlöscht:
`packages/core/src/session/sql.ts` Z. 26–29, `packages/core/src/project/sql.ts` Z. 20–35, `packages/core/src/control-plane/workspace.sql.ts` Z. 13–16.

**Fix (Entscheidung: bestehende „Entferne"-Aktion umbauen, kein neuer Eintrag):**
- Der Menüpunkt bleibt „Projekt aus der Liste entfernen" (`sidebarLayout.removeProject`), aber das Verhalten wird von „rein lokal ausblenden" zu **„gesamten Tree aus OpenCode entfernen"** geändert. Schema/Name bleibt „entfernen", weil das Projekt am Laufwerk unangetastet bleibt – nur die OpenCode-DB (Projekt + zugehörige Sessions/Messages/Workspaces) räumt auf.
1. **Backend:** Neue Methode `Project.Service.remove(id)` (Vorbild `migrateProjectId` / `ProjectDirectories.remove`) mit `db.delete(ProjectTable)`; die FK-Cascades (`session/sql.ts` Z. 26–29, `project/sql.ts` Z. 20–35, `workspace.sql.ts` Z. 13–16) löschen Sessions/Messages automatisch mit. Plus neue HttpApi-Route + Handler analog `project.update`:
   - `packages/opencode/src/project/project.ts`
   - `packages/opencode/src/server/routes/instance/httpapi/groups/project.ts`
   - `packages/opencode/src/server/routes/instance/httpapi/handlers/project.ts`
   - ggf. SDK-Generierung (`packages/client`: `bun run generate`) + `packages/sdk/js/script/build.ts`.
2. **Frontend:** `sidebar.tsx` `onCloseProject` → `layout.projects.close(...)` (`context/layout.tsx` Z. 668–670, `context/server.tsx` Z. 112–122) ruft statt der rein lokalen `remove()` den neuen Server-Endpunkt auf, damit auch der DB-Tree gelöscht wird, und bereinigt danach den lokalen State (`store.projects` + `recentlyClosed`).
3. **i18n:** Deutsch/Englisch in `packages/app/src/i18n/de.ts` / `en.ts`; keine hartkodierten Strings. Text bleibt zunächst wie bisher („aus der Liste entfernen"), da der Name laut Nutzer passt.

---

## Punkt 4 – Vollzugriff: rote Auswahlfarbe auch im Chat/beim gewählten Listeneintrag

**Stand:** Die rote Kennzeichnung für `"full"` existiert aktuell nur im Permission-Selektor des Prompt-Inputs:
`packages/session-ui/src/v2/components/prompt-input/index.tsx` Z. 514–572 (`const danger = (id) => id === "full" ? "text-v2-state-fg-danger" : ""`). In der Sidebar (`packages/app/src/pages/layout-sidebar/session-item.tsx`), im Session-Header und in Messages gibt es keine Modus-Darstellung.

**Fix (Entscheidung: Composer-Footer):**
- **Bereits umgesetzt (keine Codeänderung nötig):** Der Permission-Trigger in `packages/session-ui/src/v2/components/prompt-input/index.tsx` Z. 514–572 (Default `"workspace"` Z. 22) färbt den Trigger-Button bei `full` bereits dauerhaft rot: `danger(current())` → `text-v2-state-fg-danger` (Z. 534/556/558). Das Schema existiert in `packages/ui/src/v2/styles/theme.css:74`. Der Indikator ist also auch ohne geöffnetes Dropdown dauerhaft sichtbar – damit ist der Composer-Footer-Indikator abgedeckt.

---

## Punkt 5 – Workspace-Modus: mehrere Freigabe-Abfragen gleichzeitig statt nacheinander

**Stand/Diagnose:**
- Server: `packages/opencode/src/permission/index.ts` `ask()` (Z. 59–99) legt in der `pending`-Map pro Aufruf eine neue Zeile an – **keine Warteschlange, keine Deduplizierung**. `reply()` (Z. 101–159) stößt bei „always"/„reject" über passende weitere `pending`-Requests der Session an (→ verwaiste Fehler).
- Client: Der Dock zeigt bereits nur die erste passende Anfrage pro Session (`packages/app/src/pages/session/composer/session-request-tree.tsx` Z. 31–39). Das „gleichzeitige" Gefühl kommt von System-Benachrichtigungen/Sounds pro `permission.asked` (`packages/app/src/pages/layout.tsx` Z. 366–406) und Attention-Dots (`session-item.tsx` Z. 217–230).

**Fix (in zwei Teilen):**
1. **Dedup (serverseitig) – PR #42244 übernehmen:** In `ask()` vor dem Anlegen nach einem äquivalenten `(sessionID, permission, patterns)`-Eintrag in `pending` suchen und dessen `Deferred` mitbenutzen. Beantworten löst alle Wartenden gemeinsam auf. → behebt „mehrere gleiche Abfragen".
2. **Sequenz-Anzeige (clientseitig):** Bestätigen, dass wirklich nur **eine** Abfrage pro Session gleichzeitig im Dock/Footer erscheint und weitere erst nach Absenden der vorherigen angestoßen werden; System-Benachrichtigungen/Sounds entsprechend zusammenfassen (nicht pro Request). Muster für eine echte Queue: `packages/opencode/src/acp/permission.ts` Z. 26–49.

**Dateien:** `packages/opencode/src/permission/index.ts`, Tests in `packages/opencode/test/permission/`; `packages/app/src/pages/layout.tsx`, `packages/app/src/pages/layout-sidebar/session-item.tsx`; ggf. Queue-Muster.

**Hinweis:** Der PR liegt noch **nicht** im Fork. Vor Nutzung diffen (stand, ob er auf aktuellem `dev` sauber anwendbar ist).

---

## Punkt 6 – Railbar: aktive Positionslinie bleibt beim Hover weiß

**Ursache:** `packages/app/src/pages/session/timeline/message-rail.css`:
- Aktive Linie `[data-active="true"]::before` (Z. 130–133) = `--v2-text-text-base` mit `opacity: 0.6` (hell, „bright resting colour").
- Hover-Linie `[data-near="true"]::before` (Z. 122–125) = derselbe `--v2-text-text-base` mit `opacity: 1`.
→ Beim Hover sind Hover-Linie **und** die (woanders liegende) aktive Linie weiß; außerdem gewinnt bei `data-near`+`data-active` auf derselben Linie durch spätere Regel die `data-active` (opacity 0.6) über den Hover.

**Fix (nur CSS/markup):**
1. Aktive Linie bekommt einen **dunkleren** Farbwert (z. B. `--v2-text-text-faint` mit passender Deckkraft), sodass nur die gehoverte Linie weiß bleibt.
2. Regeln so ordnen, dass `data-near` (Hover, weiß, opacity 1) über `data-active` gewinnt (Reihenfolge oder `:not([data-near])`).
3. Hellmodus analog kontrollieren (Kontrast beider Zustände).

**Dateien:** `packages/app/src/pages/session/timeline/message-rail.css`.

**Stand/Entscheidung (Punkt 6):** Fix ist bereits umgesetzt (`message-rail.css`). Die Railbar
(`message-rail.tsx/css`, 385 Zeilen) ist eine **rein mQorva-eigene, neu gebaute Datei** (nicht in
`upstream/dev`), Teil des eigenständigen Navigations-Features `session-navigation-ui` (Kandidat
#29 in `plans/upstream-kandidaten.md`). Sie bleibt **erst einmal mQorva** und geht **nicht** als
eigener PR ins Upstream. Da sie das Seitenlayout-Modus nicht beeinflusst, kann sie **später** als
Kandidat in den Plan (`plans/upstream-kandidaten.md`) aufgenommen werden – als Teil des
Session-Navigations-Pakets, nicht als Einzel-PR.

---

## Punkt 7 – Chat-Eingabe: Modell-Platz dynamisch statt abgeschnitten

**Stand:** Der Modell-Placeholder im Prompt-Input wird abgeschnitten. Betroffen: Modell-Segment/Flex-Zeile im Composer.

**Fix:**
- Platz fürs Modell flexibel (`flex: 0 1 auto` / volle Breite erlauben, wenn Platz da ist; `min-width: 0` + `text-overflow: ellipsis` nur als unterste Kappe, nicht als feste Kürzung).
- Prüfen, wo eine feste Breite/`nowrap` das Modell-Label voneinander abgeschnitten wird (`packages/app/src/components/prompt-input-v2.tsx`, `packages/session-ui/src/v2/components/prompt-input/*`, zugehörige CSS).

## Punkt 8 (neu) – Schmale Chat-Fenster: Permission- + Modellwahl laufen rechts über

**Problem:** Wird das Chat-Fenster sehr klein, liegt die Controls-Zeile des Prompt-Input v2 über
`packages/session-ui/src/v2/components/prompt-input/index.tsx` Z. 205–285. Linke Gruppe
(`flex shrink-0`) mit Add-Menü/Agent/Permission, dann `flex-1`-Abstand, rechts Gruppe
(`flex min-w-0`) mit Modell/Variant/Context plus Submit. Die wählbaren Trigger tragen
`max-w-[220px]` (Z. 534/603, Model-Control in `prompt-input-v2.tsx` ebenfalls `max-w-[220px]`).
Es gibt **keinen** responsiven/Container-Query-Mechanismus → bei schmaler Breite zwingt die
nicht schrumpfende linke Gruppe den rechten Teil (inkl. Submit) über den rechten Rand.

**Fix:**
1. Auf einen gemeinsamen Container-Query-/Resize-Ansatz umstellen: Sobald der Container zu schmal
   ist, wechseln Permission-/Agent-/Modell-/Variant-Trigger dynamisch von „Label + Chevron" auf
   **nur das Icon** (mit Tooltip/aria-label als Ersatz für die Anzeige), damit die Zeile kollabiert,
   statt überzulaufen.
2. Alle vier Select-Trigger dazu fähig machen: `max-w-[220px]` durch eine variable Breite mit
   Kollaps-Verhalten ersetzen (min-w-0 + ellipsis; bei schmalem Zustand Label ausblenden).
3. Submit-Button immer sichtbar halten; links Add-/Permission-/Agent-Selektionen nach Priorität
   kollabieren lassen.
4. Reines UI/CSS-Verhalten im neuen Design (`layout-sidebar`-Pfad / V2-Prompt-Input).

**Verifikation:** Fensterbreite Schrittweise reduzieren; prüfen, dass keine Kontrolle rechts
überlappt und der Submit-Button zugänglich bleibt; Hell-/Dunkelmodus.

---

## Punkt 9 (neu) – Zugriffsstufen: Skill-Abfrage-Lücke + fehlende Zwischenstufe + Namensgebung

**Problem A – Skills fragen bei Workspace-Zugriff immer ab:**
- Die `workspace`-Stufe fügt **keine** Regeln hinzu (`rules()` liefert `[]`, `packages/opencode/src/permission/level.ts:25`) und verlässt sich auf die Agent-/Session-Defaults.
- `packages/opencode/src/tool/skill.ts:27-32` ruft dennoch **immer** `ctx.ask({ permission: "skill", patterns: [name], ... })` auf → bei jedem Skill-Zugriff erscheint eine Abfrage, selbst wenn im Projekt frei gearbeitet werden dürfte.
- `skill` ist ein **reines Lese-/Informations-Tool** (lädt SKILL.md + Dateiliste, `skill.ts` `execute`), führt selbst nichts aus. Die riskanten Folge-Aktionen (bash/edit/write) haben jeweils eigene `ctx.ask` mit eigenen Permission-Regeln.
- Der Default ohne Regel ist `ask` (`permission/evaluate.ts:9-10`) → deshalb fragt die Workspace-Stufe jeden Skill ab.

**Ziel/Erwartung (Entscheidung Ronny):** Die Frage-Dialoge **bleiben** prinzipiell – aber **nur wenn die Rechte nicht ausreichen**, und das **in jedem Modus gleich**. D. h. die Zugriffsstufe soll darüber entscheiden, ob ein Skill-Lesevorgang eine Abfrage braucht; ein skill-Lesen, das durch die aktive Regel ohnehin erlaubt ist, darf nicht künstlich eine Bestätigung erzwingen. Wenn die Rechte es nicht zulassen (z. B. bestimmte Skill-Datei außerhalb des erlaubten Bereichs), wird **weiterhin** gefragt – unabhängig vom Modus.

**Entscheidung (Option 1, festgehalten):** Skill wird wie ein **Lese-Tool** behandelt (analog `read`/`grep`/`glob`, die laut `level.ts:11-12` auf allen Stufen still sind). Intern bleibt es bei **3 Stufen** (`ask` / `workspace` / `full`) – **keine** vierte Zwischenstufe. Das Skill-Lesen selbst verleiht keine Rechte und fragt nicht ab; die riskanten Folge-Aktionen (bash/edit/write), die ein Skill auslöst, behalten unverändert ihre eigenen `ctx.ask` mit eigenen Regeln. Damit bleibt „im Zweifel Fragen, wenn die Rechte nicht reichen" vollständig erhalten – nur die redundante Skill-Lese-Abfrage entfällt.

**Fix umsetzen:**
- `skill`-Anfragen für die `workspace`-Stufe still durchlassen (auf „allow" setzen statt Default `ask`); der Default ohne Regel bleibt `ask` (`permission/evaluate.ts:9-10`), aber da Skill nur liest, analog zu `read` in die stillen Leseoperationen eingeordnet.
- Kein `danger`-Flag, keine neue Level-ID, keine zusätzliche Stufe.
- **Zu prüfen (Implementierung):** ob `skill` konfigurierbar sein soll (global `permission`-Config/Agent-`defaults` können eine `skill`-Regel bereits setzen und würden das Verhalten übersteuern).

**Zu prüfen:** Was die aktive Ruleset für `skill` als Default setzt (Agent-`defaults`, global `permission`-Config) und ob `skill` dort standardmäßig `ask` oder `allow` ist; ob sinnvoll, Skills mit einem Gefährdungs-Flag (`danger`) zu versehen, das den Modus übersteuert.

**Problem B – fehlende Zwischen-/Semantikstufe zwischen Workspace und Vollzugriff:**
- Aktuell gibt es nur `ask` / `workspace` / `full` (`packages/schema/src/v1/permission.ts:30-33`, `packages/ui/src/i18n/{de,en}.ts`).
- Es fehlt: **„im Projekt schreiben, außerhalb nur lesen (keine Änderungen)"** – d. h. Leseoperationen (read, grep, glob, lsp, list) bleiben still, Schreib-/Ausführ-/Netzzugriff außerhalb des Projekts wird abgefragt (oder gelesen wird erlaubt, geschrieben nie).
- **Entscheidung (Punkt 9, festgehalten): Diese Stufe wird **nicht** eingeführt.** Es bleibt bei den bestehenden **3 Stufen** `ask` / `workspace` / `full`. Dafür muss klar sein, dass „workspace" bereits implizit Erlaubnis für die Projektarbeit darstellt; die gewünschte Abfrage bei Rechte-Überschreitung (z. B. außerhalb des Projekts schreiben) leistet bereits die bestehende `workspace`-Semantik („nur bei Dateien außerhalb und beim Lesen von .env-Dateien nachfragen", `de.ts:223-224`).

**Problem C – Namensgebung:**
- „Workspace-Zugriff" passt nicht zur Produktsprache: mQorva hat **Projekte**, keine Workspaces.
- Aktuelles Label `ui.promptInput.permission.workspace` = „Workspace-Zugriff" (`de.ts:222`), Beschreibung `de.ts:223-224`: „Im Workspace frei arbeiten. Nur bei Dateien außerhalb und beim Lesen von .env-Dateien nachfragen."
- Ideen für klare Namen im Plan:
  - Zwischenstufe: „Projekt" (nur im Projekt schreiben) vs. „Projekt + außen lesen" (im Projekt schreiben, außerhalb lesen) – oder zweistufig mit aussagekräftiger Beschreibung.
  - Vorschlag Ronny: „nur Projekt" und „Projekt schreiben, außerhalb lesen" – als **Labels/Erklärungstexte**, nicht als interne Level-IDs (behalten `ask`/`workspace`/`full` als IDs für Kompatibilität? Oder neue IDs? → entscheiden).

**Fix-Kandidaten:**
1. **Problem A (entschieden):** `skill` wie ein Lese-Tool behandeln – still in der `workspace`-Stufe, Frage-Dialoge bleiben nur bei nicht ausreichenden Rechten (Folge-Aktionen behalten ihre Abfragen).
2. **Problem B (entfällt):** keine vierte Stufe einführen; bei 3 Stufen bleiben.
3. **Problem C (Namensgebung):** „Workspace-Zugriff" klingt projektsemantisch komisch – IST jedoch nicht Gegenstand dieser Entscheidung. Vorschlag unverändert: Labels/Beschreibungen überarbeiten, ohne interne Level-IDs zu ändern (Kompatibilität). Nur deutsche Übersetzung anpassen, Source-English unangetastet (`de.ts:222-224`), Entscheidung zur Namensgebung in Punkt 9 offen/optional.

**Entscheidungspunkt abschließend geklärt:** Es bleibt bei **3 Stufen**; Skill-Zugriff wird wie `read`-Tools still behandelt. Kein neues Level, kein Skill-`danger`-Flag, keine neue Level-ID. Offen bleibt nur die optionale Überarbeitung der Labels (Problem C — „Workspace-Zugriff" → projekteinschlägige Benennung) und die `skill`-Konfigurierbarkeit bei der Implementierung.

**Verifikation:** Permissions-Matrix pro Tool/Kontext durchtesten; Skill-Zugriff im Workspace-Modus ohne unnötige Abfrage; **3 Stufen** bestätigen (ask/workspace/full); Frage-Dialoge erscheinen weiterhin bei nicht ausreichenden Rechten (außerhalb Projekt schreiben, `.env`); i18n deutsch/englisch (falls Labels überarbeitet werden).

---

1. **Phase A – Schnelle UI-Bugs (keine Architektur):** Punkt 6 (Railbar-CSS), Punkt 1 (Thinking-Overflow), Punkt 7 (Modell-Platz), Punkt 8 (schmales Fenster - Icons).
2. **Phase B – Berechtigungen (Punkt 5 + 9):** PR #42244 einpflegen (nur Dedup, keine zusätzliche Warteschlange) + Zugriffsstufen (Skill-Lücke, Zwischenstufe, Namensgebung).
3. **Phase C – Punkt 4:** Roher Vollzugriff-Indikator im Composer-Footer.
4. **Phase D – Projekt entfernen (Punkt 2/3):** Backend-Endpunkt + Umbau der „Aus der Liste entfernen"-Aktion + i18n.

## Entscheidungen (in Recherche geklärt + ergänzt)

1. **Punkt 2/3:** Die bestehende „Aus der Liste entfernen"-Aktion wird umgebaut; Name bleibt (Projekt nur aus OpenCode entfernt, am Laufwerk unangetastet), aber der **gesamte Tree** (Projekt + Sessions/Messages/Workspaces in der DB) wird entfernt. Kein neuer Menüpunkt.
2. **Punkt 4:** Rote Vollzugriff-Kennzeichnung als dauerhaft sichtbarer Indikator im **Composer-Footer**.
3. **Punkt 5:** Nur serverseitige Deduplizierung über PR #42244 – **keine** zusätzliche sequenzielle Warteschlange.
6. **Punkt 6 (Railbar):** Fix gesetzt; bleibt **mQorva-eigen** – kein PR jetzt, später als Kandidat im `session-navigation-ui`-Kontext (beeinflusst Seitenlayout-Modus nicht).
9. **Punkt 9 (Zugriffsstufen):** **Entschieden – bei 3 Stufen bleiben** (`ask`/`workspace`/`full`). Skill wird wie ein Lese-Tool behandelt (still in der Workspace-Stufe); Frage-Dialoge bleiben nur bei nicht ausreichenden Rechten. Keine vierte Stufe, kein Skill-`danger`-Flag. Offen/optional: Labels überarbeiten („Workspace-Zugriff" → projekteinschlägig).

## Verifikation

- `bun typecheck` in `packages/app` und `packages/opencode`.
- Tests: `packages/opencode/test/permission/next.test.ts`, `packages/app`-UI-Tests.
- Manuell: Hell-/Dunkelmodus für Punkt 1/6/7; Projekt entfernen + Neustart für Punkt 2/3; Workspace-Modus mit mehreren Befehlen für Punkt 5.
- Vor Session-/Timeline-Änderungen: Produktions-Benchmark-Baseline aufnehmen (laut `packages/app/AGENTS.md`).

## Entscheidungen (in Recherche geklärt)

1. **Punkt 2/3:** Die bestehende „Aus der Liste entfernen"-Aktion wird umgebaut; Name bleibt (Projekt nur aus OpenCode entfernt, am Laufwerk unangetastet), aber der **gesamte Tree** (Projekt + Sessions/Messages/Workspaces in der DB) wird entfernt. Kein neuer Menüpunkt.
2. **Punkt 4:** Rote Vollzugriff-Kennzeichnung als dauerhaft sichtbarer Indikator im **Composer-Footer**.
3. **Punkt 5:** Nur serverseitige Deduplizierung über PR #42244 – **keine** zusätzliche sequenzielle Warteschlange.