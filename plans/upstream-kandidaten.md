# Upstream-Klassifizierung des Fork-Diffs (`upstream/dev..dev`)

Bestandsaufnahme aller Fork-Änderungen gegenüber `anomalyco/opencode`: Was ist eigen, was ist Naht,
was kann zurück ans Original? Grundlage für künftige Upstream-PRs und für die Pflege von
`plans/upstream-patches.md`. Zuletzt vollständig gegen `upstream/dev` `04284921ac`, Fork `dev`
`ec00c58590` und `upstream/v2` `fac875dba0` geprüft. Der Upstream-Sync übernimmt den Rename-Fix aus
`#46116` in die mQorva-Titelleiste, ohne deren Sidebar-Portal zu entfernen; daraus entsteht kein
neuer Upstream-Kandidat. Die acht veröffentlichten Paketbranches sind weiterhin offen, ihre dokumentierten HEADs unverändert und die
gemeldeten Standard-/Compliance-Checks erfolgreich; GitHub meldet sie ohne Maintainer-Freigabe als
blockiert. Der fokussierte
Rename-/Tab-E2E-Test lief im expliziten Tabs-Modus mit 8/8 Szenarien erfolgreich. Für App-Features
wurde zusätzlich der aktive Architekturzweig `upstream/v2` auf `fac875dba0` geprüft, weil dort
bereits Funktionen und Dateistrukturen liegen, die `dev` noch nicht enthält.

## Stand der bisherigen Upstream-Versuche

Die ersten drei Kandidaten wurden am 27. August 2026 jeweils als eigener, sauber von
`upstream/dev` abgezweigter Ein-Commit-Branch gesendet. Die PRs wurden nicht fachlich abgelehnt,
sondern automatisch geschlossen, weil ein vorheriges Issue und die vollständig ausgefüllte
PR-Vorlage fehlten. Die alten lokalen und `origin`-Branches wurden nach Sicherung ihrer Spitzen als
lokale Archiv-Tags entfernt und werden nicht unverändert wiederverwendet:

| Kandidat | Alter PR | Zustand | Nächster Schritt |
|---|---:|---|---|
| #1 | `anomalyco/opencode#45557` | geschlossen, nicht gemergt; Branch entfernt, Tag `archive/upstream-pr-45557` | Duplikate prüfen, Issue anlegen, frisch von aktuellem `upstream/dev` extrahieren und erneut testen |
| #2 | `anomalyco/opencode#45607` (alt) / `anomalyco/opencode#46125` (neu) | alt: geschlossen, nicht gemergt; Branch entfernt, Tag `archive/upstream-pr-45607`. neu: PR offen gegen `upstream/dev` `10765ff2a9`, Branch `async-session-idle` HEAD `763d4ca96d`, Issue #45610; `tsgo --noEmit` exit 0 | auf Maintainer-Feedback warten |
| #3 | `anomalyco/opencode#45609` | geschlossen, nicht gemergt; Branch entfernt, Tag `archive/upstream-pr-45609` | Root-Fall testen, danach Issue und neuer kurzer Branch |

`v2-compat.ts` und die zwischenzeitlichen Azure-Anpassungen sind keine neuen Fork-Kandidaten:
Upstream enthält inzwischen die V2-Konfigurationskompatibilität und die aktuelle Azure-
Authentifizierung selbst. Gegen den aktuellen Upstream bleibt in `config.ts` davon nur Kandidat #6.

## Versandmodell: Branchpakete statt Fork-Historie

Die 33 Fork-Commits gegenüber `upstream/dev` sind **keine** 33 Upstream-PRs. Viele davon sind
Zwischenstände mit mehreren vermischten Themen. Für Upstream wird deshalb nicht die bestehende
Historie weitergereicht, sondern jedes fachliche Paket frisch aus ausgewählten Hunks aufgebaut:

1. unmittelbar vor der Bearbeitung von dem dann aktuellen `upstream/dev` abzweigen;
2. nur die zum Paket gehörenden neutralen Änderungen übernehmen, niemals einen der gemischten
   `mQorva edition`-Commits vollständig cherry-picken;
3. Entwicklungszwischenstände zu einem sauberen Commit verdichten oder höchstens zwei Commits
   behalten, wenn Infrastruktur und darauf aufbauendes Verhalten getrennt prüfbar sind;
4. Issue, Tests und PR-Vorlage für das gesamte Problem-Paket vorbereiten;
5. erst nach Freigabe pushen und den PR anlegen.

Die Branches werden absichtlich **nicht auf Vorrat angelegt**. Ein vorbereiteter, aber noch nicht
gesendeter Branch würde beim nächsten Upstream-Sync altern. Die folgende Tabelle ist daher die
verbindliche Bauanweisung; der jeweilige Arbeitsbranch entsteht just-in-time in einem separaten
Worktree. Die Namen erfüllen bereits die lokale Drei-Wort-Regel.

### Korrekturen vor dem Upstream-Versand nachziehen

Ein Branchpaket ist kein einmaliger Export eines alten Fork-Commits. Vor jedem Issue-/Push-Gate wird
es gegen den aktuellen Fork erneut abgeglichen:

1. aktuellen `upstream/dev`-Stand abrufen und den Paketbranch beziehungsweise dessen Worktree
   identifizieren;
2. den aktuellen Paketvertrag aus dieser Datei mit `git diff upstream/dev..dev` vergleichen;
3. neue Korrekturen aus `dev` nur hunkweise übernehmen und erneut auf mQorva-, V1/V2-, Branding-
   oder andere Fremdanteile prüfen;
4. einen noch nicht gepushten Paketbranch auf dem aktuellen `upstream/dev` sauber neu aufbauen oder
   seine lokalen Commits amendieren/squashen;
5. bei einem bereits offenen PR Korrekturen als normale Folgecommits auf denselben Branch pushen;
   veröffentlichte Commits nur nach ausdrücklicher Freigabe mit `--force-with-lease` umschreiben;
6. Diff, Paket-Typechecks, fokussierte Tests und bei UI-Paketen die visuelle Abnahme vollständig
   wiederholen;
7. hier Upstream-Basis, Fork-Quellstand, Branch-HEAD, Prüfungen und Status aktualisieren, bevor der
   Veröffentlichungshelfer laufen darf.

Stand: `async-session-idle` (Kandidat #2) ist als PR #46125 offen, basiert auf `upstream/dev`
`10765ff2a9`, HEAD `763d4ca96d`. Vor jedem Update dieses PRs Diff, Hunks und Status gegen den
aktuellen Fork-Stand `b152378fed` erneut prüfen. Die übrigen Kandidaten haben noch keine
Paketbranches; ihre Korrekturen liegen weiter auf `dev`/`origin/dev` und werden beim späteren
just-in-time-Aufbau automatisch aus dem aktuellen Verhaltensdiff übernommen.

### Zusätzlicher Upstream-Architektur-Gate

Für kurzfristige PRs bleibt `upstream/dev` die verbindliche Basis. Bei App-Features reicht dieser
Vergleich inzwischen aber nicht mehr: Der aktive Zweig `upstream/v2` steht auf `fac875dba0`, hat
eine vollständig neue App-Dateistruktur und enthält bereits Änderungen, die auf `dev` noch fehlen.
Die bisherigen App-Dateien für Global Sync, Prompt-Submit, Terminalzustand, Provider-Verbindung und
Fehlerauswertung existieren dort nicht mehr unter denselben Pfaden.

Besonders relevant:

- Issue `#36942` fordert vertikale Sitzungsnavigation; PR `#38308` ist dafür gegen `dev` offen.
- PR `#45210` hat experimentelle vertikale Sitzungstabs bereits nach `v2` gemergt.
- Diese Vertical-Tabs-Arbeit ändert die Darstellung vorhandener Tabs. Unser Seitenleistenpaket
  verändert die Tab-Mechanik ebenfalls nicht: Es liest den bestehenden Tab-Zustand, blendet dessen
  horizontalen Strip im Seitenleistenmodus aus und ergänzt nur `unassigned` als additives
  Draft-Merkmal für den Block „Chats“.
- `v2` bietet Queue und Steer als echte Einstellung samt Queue-Panel und E2E-Tests; unser Paket #22
  darf daher nicht mehr als neuer Upstream-Vertrag gesendet werden.
- Markdown-Vorschau wurde mit Issue `#13705` und PR `#13704` bereits versucht, aber ohne Merge
  geschlossen. Das ist ein wiederaufsetzbarer Featurepfad, kein unbekanntes neues Konzept.
- Ein Sprung zu Nutzereingaben wurde in PR `#38484` versucht und nur wegen fehlender Compliance
  geschlossen; auch die Sitzungsnavigation hat damit bekannte Upstream-Historie.

### Abarbeitungsliste: PR-Pakete in Reihenfolge

Die Core-/Server-/Desktop-Korrekturen werden gebündelt, wenn sie dasselbe Modul oder denselben
Reviewer-Pfad teilen. v2-abhängige Pakete (`sidebar-workspace-ui`, `session-navigation-ui`,
`provider-catalog-sync`, `workspace-readiness-ui`, `session-workspace-layout`,
`markdown-file-preview`, `native-model-routing`, `followup-queue-controls`) bleiben hier außen
vor und werden erst nach dem v2-Architektur-Gate angegangen. Permission-Verträge `#32` und
`#33` sind im Fork gemeinsam committed, gehören aber laut Inventar-Logik in zwei getrennte PRs.

| Reihenfolge | PR-Paket (Branch) | Kandidaten | Status | Inhalt / Voraussetzung |
|---:|---|---|---|---|
| 0 | `auth-json-safety-pilot` | #1 | PR #46023 offen gegen `upstream/dev` `10765ff2a9`, HEAD `5b9bb8411c`, Issue #46020; +34/-12 in `auth/index.ts`; `tsgo --noEmit` exit 0; am 30.08. re-rebased von `dc4449df0d` auf `10765ff2a9` | auf Maintainer-Feedback warten |
| 1 | `async-session-idle` | #2 | PR #46125 offen gegen `upstream/dev` `10765ff2a9`, HEAD `763d4ca96d`, Issue #45610; `tsgo --noEmit` exit 0 | auf Maintainer-Feedback warten |
| 2 | `init-safety` (Bündel) | #6 + #7 | PR #46162 offen gegen `upstream/dev` `10765ff2a9`, Branch-HEADs `a856022bf7` (Tip) / `85a2b3bdb2` (#6) / `edd743a009` (#7); Issues #42002 und #46161; +4/-1 in `config.ts` und +11/-5 in `plugin/index.ts`; `tsgo --noEmit` exit 0. **Konkurrenz:** PR #42003 fixt dasselbe Issue #42002 über `InstallationChannel === "latest"` (statt `InstallationVersion.startsWith("0.0.0-dev")`) und berührt `config.ts` + `tui.ts`. Maintainer entscheidet, welche Heuristik gemergt wird; PR #46162 wird nicht zurückgezogen, sondern läuft parallel | auf Maintainer-Entscheidung warten |
| 3 | `filesystem-root-watch` | #3 | PR #46148 offen gegen `upstream/dev` `10765ff2a9`, HEAD `46bcd01c49`, Issue #45611; +7/-2 in `watcher.ts`; `tsgo --noEmit` exit 0 | auf Maintainer-Feedback warten |
| 4 | `bootstrap-init-timeout` | #8 | PR #46167 offen gegen `upstream/dev` `10765ff2a9`, HEAD `cc3fe65b0c`, Issue #46166; +16/-2 in `bootstrap.ts`; `tsgo --noEmit` exit 0 | auf Maintainer-Feedback warten |
| 5 | `windows-zorder-reset` | #20 | PR #46305 offen gegen `upstream/dev` `10765ff2a9`, HEAD `13bed544a9`, Issue #46304; +5/-0 in `windows.ts`; `tsgo -b` exit 0 in `packages/desktop`; **Windows-Runtime-Nachweis blockiert** (kein Win-Host in dieser Umgebung), ehrlich im PR-Body dokumentiert | auf Maintainer-Feedback warten, ggf. Win-Verifikation durch Maintainer |
| 6 | `build-and-dev-flags` (Bündel) | #9 + #21 | PR #46196 offen gegen `upstream/dev` `10765ff2a9`, HEADs `d93bd149da` (Tip) / `a748a93544` (#9) / `9fda3f7da1` (#21); Issues #46194 und #46195; +2/-1 in `build.ts` und +4/-1 in `index.ts`; `tsgo --noEmit` exit 0 in beiden Paketen | auf Maintainer-Feedback warten |
| 7 | `permission-dock-layout` | #32 | **entfällt vorerst**: Fork-Hunk nicht mehr in `upstream/dev` auffindbar (`git diff upstream/dev..dev` ist leer für die betroffenen Dateien auf `10765ff2a9`). Letzter Fork-Commit auf `dev` ist `b152378fed chore: Repo-Root, packages aktualisiert (2 Dateien)`; entweder wurde der Fork-Patch durch nachfolgende `chore:`-Updates neutralisiert oder Upstream hat die Logik inzwischen selbst. Vor Re-Aufnahme Inventar-Check und `git log` der Original-Commits nötig | — |
| 8 | `persistent-permission-choice` | #33 | PR #46302 offen gegen `upstream/dev` `10765ff2a9`, HEAD `a2beb0b98c`, Issue #46301; +7/-0 in `session-composer-state.ts`; `tsgo -b` exit 0 in `packages/app` | auf Maintainer-Feedback warten |
| 9 | `desktop-dev-identity` | #34 | PR #46474 offen gegen `upstream/dev` `04284921ac`, HEAD `47e49d1f59`, Issue #46473; +23/-1 in `app-identity.ts`, Test und `index.ts`; Identitätstest 2/2, Desktop-Typecheck und Build erfolgreich. Der verwandte gemergte PR #23368 führte die explizite Windows-ID ein, trennte aber den unverpackten Start nicht von der installierten Dev-App. | auf Maintainer-Feedback und Pflichtchecks warten |
| v2-1 | `sidebar-workspace-ui` | #28 + Sidebar-Teile aus #31 | blockiert | gegen `v2` re-evaluieren |
| v2-2 | `session-navigation-ui` | #18, #19, #25, #29 | blockiert | gegen `v2` re-evaluieren |
| v2-3 | `session-workspace-layout` | layoutneutrale Teile aus #31 | blockiert | nach `v2` Übernahme |
| v2-4 | `workspace-readiness-ui` | #27 | blockiert | nach `v2` Übernahme |
| v2-5 | `provider-catalog-sync` | #11 | blockiert | gegen `v2` |
| v2-6 | `markdown-file-preview` | #30 | blockiert | Design-Issue, gegen `v2` |
| v2-7 | `native-model-routing` | #5 | blockiert | Design-Issue, Routingmatrix |
| app-v1 | App-Fixes #12, #13, #14, #15, #16, #17, #23 | diverse | blockiert | alter App-Pfad fehlt in `v2`; erst nach v2-Übernahme neu reproduzieren |
| entfällt | `followup-queue-controls` | #22, #26 | entfällt | in `v2` bereits umgesetzt |
| ohne | `session-title-generation` | #4, #24 | ohne Branch | Architekturentscheidung offen |

Damit sind 10 PR-Pakete (9 veröffentlicht, 1 entfallen) der „Non-v2"-Strecke definiert. Die Pakete
0–6, 8 und 9 sind veröffentlicht; Paket 7 ist vorerst entfallen.

### Zusammenhängende Features und größere Funktionsverträge

| Arbeitstitel | Kandidaten | Upstream kennt bereits | Urteil |
|---|---|---|---|
| `provider-catalog-sync` | #11 | Providerkatalog, Connect/Disconnect und zwei Settings-Oberflächen auf `dev`; neue Providerarchitektur auf `v2` | ein zusammenhängender Funktionsvertrag, aber nicht vor Vergleich mit `v2` extrahieren |
| `native-model-routing` | #5 | allgemeine Modellauflösung, aber nicht unsere native Gemini-/OpenRouter-Weiche | eigenständiges Core-Feature mit Design-Issue und Routingmatrix |
| `build-no-minify` | #9 | minifizierten Build und Sourcemap-Schalter | eigenständige Buildoption; nicht mit Desktop-Debugport koppeln |
| `desktop-debug-port` | #21 | festen Dev-Port `9222` | eigenständige Desktopoption mit Env-Smoke |
| `markdown-file-preview` | #30 | geschlossene Vorgänger `#13705`/`#13704` | ein Feature; Vorgänger sauber referenzieren und erst auf der vom Upstream gewünschten App-Basis neu extrahieren |
| `session-navigation-ui` | #18, #19, #25, #29 | ScrollView, Timeline und den geschlossenen Versuch `#38484`; keine Message-Rail auf `dev` oder `v2` | ein eigenständiges, layoutneutrales Navigationsfeature; nicht an die Sidebar koppeln |
| `sidebar-workspace-ui` | #28 plus nur sidebar-spezifische Teile aus #31 | offenes Issue `#36942`, offenen PR `#38308` auf `dev` und gemergte Vertical-Tabs-Darstellung `#45210` auf `v2` | unser Feature bleibt eigenständig: Upstream hat keine gruppierte Workspace-Seitenleiste mit separaten Chats, Anheften, Suche und Entwurfsverschiebung. Keine Tab-Struktur übertragen oder ersetzen; die Sidebar wird an Upstreams bestehende Tab- und Shell-Verträge angehängt. Zu extrahieren sind nur der Layout-Einhängepunkt, das Ausblenden des horizontalen Strips, das additive `unassigned`-Draft-Merkmal und der neue Workspace-/Sidebar-Code |
| `session-workspace-layout` | verbleibende layoutneutrale Teile aus #31 | neue Session-/Panel-/Terminal-Struktur in `v2` | nicht Teil des Sidebar-PRs; nach Übernahme von `v2` als eigenes Layout-Feature neu bewerten |
| `workspace-readiness-ui` | #27 | mehrere neue Lade- und Skeleton-Zustände in `v2`, aber nicht unseren Fortschrittsvertrag | Vertrag und Darstellung hängen zusammen, Implementierung jedoch erst auf der neuen App-Architektur neu entwerfen |
| `followup-queue-controls` | #22, #26 | auf `dev` absichtlich verborgen; in `v2` vollständig auswählbar und E2E-getestet | als neues Feature **entfällt**; nach `v2` nur noch einzigartige Queue-Aktionen vergleichen und gegebenenfalls als kleinen Folge-Fix vorschlagen |
| `session-title-generation` | #4, #24 | bestehende Titelkonventionen; unsere beiden Richtungen widersprechen sich | kein Branch vor Architekturentscheidung |

Damit sind `sidebar-workspace-ui`, `session-navigation-ui` und `session-workspace-layout` aus unserer
Produktperspektive zwar Teile derselben Oberfläche, aus Upstream-Sicht aber **nicht ein PR-Paket**:
Sitzungsnavigation funktioniert ohne Sidebar; unser eigenständiger Workspace-Vertrag verwendet
Upstreams Tab-Zustand nur als Datenquelle und ersetzt ihn nicht; und die allgemeine
Arbeitsflächenanordnung muss auf der neuen `v2`-Struktur aufbauen.

Kandidat #10 (`complete-user-journey.test.ts`) wird nicht als eigener Test-PR verschickt. Der Test
ist derzeit breit, verwendet noch unscharfe Typen und beweist keinen der offenen Fehlerpfade. Seine
brauchbaren Teile werden nur dann in ein Paket übernommen, wenn sie genau dessen Regression
absichern.

## Empfehlungen in Reihenfolge

Die konkrete Reihenfolge und Bündelung der PR-Pakete steht in der
**Abarbeitungsliste: PR-Pakete in Reihenfolge** weiter oben. Diese Sektion hier hält nur
die querschnittlichen Pflichten, die unabhängig vom konkreten Paket gelten:

1. **Patch-Dokument nachziehen — erledigt**: `message-timeline.tsx`, Follow-up-/Queue-Bündel,
   `tabs.tsx`/`tab-migration.ts` und Session-UI-Nähte sind als Abschnitte 13–17 in
   `plans/upstream-patches.md` mit Markern 14a–18a in `patches.ps1` erfasst; alle 48 Marker
   grün. Übrig bleibt nur die negative Prüfung Icon-Discovery (Abschnitt 18, von Hand).
2. **Tabs-Abweichungen akzeptieren und dokumentieren** — erledigt: Abschnitt „Sichtbare
   Abweichungen im Tab-Modus" unten. Alle vier Stellen sind Verbesserungen, die auch im
   Tab-Modus funktionieren; der Umschalter bleibt voll bedienbar.
3. **Nicht-v2-Pakete zuerst**: Pakete 0–9 der Abarbeitungsliste (Auth, Async-Idle, Init-Safety,
   Filesystem-Root, Bootstrap-Timeout, Windows-Z-Order, Build-Flags, Permission-Dock,
   Permission-Choice und Dev-App-Identität) sind unabhängig vom `v2`-Architektur-Gate und werden in dieser
   Reihenfolge abgearbeitet. Bündel (`init-safety`, `build-and-dev-flags`) erhalten je
   eine intentionale Commit-Serie, damit die Mitglieder einzeln prüfbar bleiben.
4. **v2-Pakete nach Architektur-Gate**: v2-1 bis v2-7 sowie `app-v1` erst nach Übernahme
   beziehungsweise Re-Evaluation gegen den aktuellen `upstream/v2`-Stand. Bis dahin
   **keine Paketbranches auf Vorrat** anlegen.
5. **UI als bekannte Upstream-Themen weiterführen**: Die mQorva-Seitenleiste bleibt eine eigene,
   umfangreichere Lösung, wird aber gegen `#36942`, `#38308` und den nach `v2` gemergten PR
   `#45210` abgegrenzt. Markdown-Vorschau und Sitzungsnavigation knüpfen an ihre geschlossenen
   Vorgänger an. Erst nach dieser Design-Abstimmung entstehen Featurebranches.

## Kategorien

- **A — mQorva-eigen**: Editionsidentität, Branding, Buildmodell und nur für den Fork nötige
  Shell-Nähte. Bleibt im Fork. Ein produktneutral formulierter alternativer Arbeitsbereich kann
  dagegen nach Design-Abstimmung ein D-/C-Kandidat sein.
- **B — Integrationsnaht**: Fork-only Hook in gemeinsamer Datei (idealerweise mit Marker in
  `plans/upstream-patches.md` erfasst).
- **C — Upstream-Kandidat**: produktneutral, kein Bezug auf Sidebar/Edition; als eigener PR gegen
  `upstream/dev` möglich. Zweig immer von `upstream/dev` abschneiden, nie vom mQorva-`dev`.
- **D — gemischt/unklar**: enthält C-Anteile, braucht Trennung oder Entscheidung.

## C — Upstream-Kandidaten nach PR-Clustern

### Backend (stärkste Ausbeute, UI-unabhängig)

| # | Vorschlag | Dateien | Tests |
|---|---|---|---|
| 1 | `fix(opencode): serialize and atomically write auth.json` | `opencode/src/auth/index.ts` | `test/auth/auth.test.ts` (Concurrency-Regression vorhanden) — **stärkster Einzelkandidat** |
| 2 | `fix(server): reset session status to idle when async prompt fails` | `opencode/src/server/routes/instance/httpapi/handlers/session.ts` | Fehlerpfad noch ungetestet → Lücke |
| 3 | `fix(core): skip file watcher on filesystem roots` | `core/src/filesystem/watcher.ts` | `watcher.test.ts` ohne Root-Fall → ergänzen |
| 4 | `feat(core): use plain default session titles` | `core/src/session.ts`, `opencode/src/session/session.ts`, `tui/src/util/session.ts` | `tui/test/util/session.test.ts`; **Vorbehalt**: dreht Upstreams bewussten Fix (#40385) teilweise um — vorher mit Upstream klären, ob die Richtung gewollt ist |
| 5 | `feat(core): add native Gemini and OpenRouter model routing` | `core/src/session/runner/model.ts` | `session-runner-model.test.ts` erweitern |
| 6 | `fix(opencode): don't pin plugin version for 0.0.0-dev builds` | `opencode/src/config/config.ts` | — |
| 7 | `fix(opencode): time out internal plugin init and config hooks` | `opencode/src/plugin/index.ts` | — |
| 8 | `chore(server): log and bound instance service bootstrap` | `opencode/src/project/bootstrap.ts` | — (Timeout ändert Verhalten bei langsamem Init) |
| 9 | `chore(opencode): add --no-minify flag to build script` | `opencode/script/build.ts` | — |
| 10 | Breiter End-to-End-Test als Material für andere Pakete, **kein eigener PR** | `opencode/test/server/complete-user-journey.test.ts` | nur passende Teile nachschärfen und dem konkret abgesicherten Paket beilegen; aktueller Test enthält noch `any` und deckt keinen offenen Fehlerpfad gezielt ab |

### App-Fixes

| # | Vorschlag | Dateien | Tests |
|---|---|---|---|
| 11 | `fix(app): make provider connect and disconnect reflect the actual catalog` (§12-Vertrag, ein zusammenhängender PR über ~9 Dateien; Splitting: Infrastruktur zuerst, dann Vertrag + 4 UI-Stellen) | `components/provider-connection.ts`, `dialog-connect-provider.tsx`, `dialog-custom-provider.tsx`, `settings-providers.tsx`, `settings-v2/providers.tsx`, `context/server-sync.tsx` (`refreshProviders(directory?)`), `utils/server-compat.ts` (nur Dispose-/OAuth-Teil!), `hooks/provider-catalog.ts`, `hooks/use-providers.ts` | `provider-connection.test.ts`, `server-compat.test.ts`; je ein Test pro Settings-Variante empfohlen |
| 12 | `fix(app): handle session.error events in global sync` | `context/global-sync/event-reducer.ts` | `event-reducer.test.ts` (neuer Case vorhanden); i18n-Schlüssel existieren bereits upstream |
| 13 | `fix(app): await slow loads before completing directory bootstrap` | `context/global-sync/bootstrap.ts` | `bootstrap.test.ts` |
| 14 | `fix(app): back off event stream reconnects after repeated failures` | `context/server-sdk.tsx` | keine dedizierten Tests |
| 15 | `fix(app): recover prompt text from editor dom on empty store` | `components/prompt-input/submit.ts` + `session-ui` Parser-Export (`editor-dom.ts`, `index.tsx`, `package.json`) | `submit.test.ts` vorhanden |
| 16 | `fix(app): send v1 follow-up prompts to their session directory` | `submit.ts` | Invert-Fall ergänzen |
| 17 | `fix(app): detect session-not-found across legacy error shapes` | `utils/server-errors.ts` | `server-errors.test.ts` erweitern |

### UI-Paket / Desktop

| # | Vorschlag | Dateien | Tests |
|---|---|---|---|
| 18 | `feat(ui): support always-visible scrollbar thumbs and configurable track inset` | `ui/src/components/scroll-view.tsx` | rückwärtskompatibel, rein additiv |
| 19 | Scrollbar-Stepper über dem Sitzungsbereich (C-Fragment aus `pages/session.tsx` + `message-timeline.tsx`: `thumbContainer`-Threading) | beide Dateien gezielt herauslösen | manuell |
| 20 | `fix(desktop): clear stuck always-on-top after first show on windows` | `desktop/src/main/windows.ts` | Z-Order nicht in Bun-Tests abbildbar → manuell Win10/11; **einziger sauberer Desktop-PR ohne Vorarbeit** |
| 21 | `feat(desktop): allow configuring dev remote-debugging-port` (Fragment aus `main/index.ts`, 9223-Default herausfaktorieren) | `desktop/src/main/index.ts` | Smoke auf Env-Übernahme |
| 22 | Queue/Steer-Auswahl und Ctrl+Enter-Inversion — auf `dev` ist Queue noch absichtlich unerreichbar; `v2` enthält inzwischen die echte Auswahl, Queue-Panel und E2E-Abdeckung | `context/settings.tsx`, `components/settings-v2/general.tsx`, `prompt-input/submit.ts`, `session-ui/.../interaction.ts`, `i18n/en+de.ts` | **kein neuer Featurebranch**; nach Übernahme von `v2` nur die dort fehlende Ctrl+Enter-Inversion oder einzelne Queue-Aktion als separaten Follow-up-Kandidaten prüfen |

### Seit der letzten Bestandsaufnahme hinzugekommen

| # | Einstufung und Vorschlag | Dateien | Vorbedingung / Tests |
|---|---|---|---|
| 23 | **C** — `fix(app): preserve workspace terminals across session routes` | `packages/app/src/context/terminal.tsx`, `packages/app/src/context/terminal.test.ts` | vorhandene Registry-Tests plus `packages/app`-Typecheck; gegen reinen Upstream extrahieren |
| 24 | **D** — `feat(core): generate initial v2 session titles` | `packages/core/src/session/info.ts`, `packages/core/src/session/runner/llm.ts`, `packages/core/src/session/runner/model.ts`, `packages/core/test/session-runner.test.ts` | Architektur vorab mit Upstream klären; V1-Event-Projektion und allgemeine Modellauflösung vom eigentlichen Titeljob trennen. Stand `9405502779`: erkennt zusätzlich Upstreams datierte Standardtitel, respektiert die Agent-/Provider-Tokenkonfiguration statt `maxTokens: 64` zu erzwingen und besitzt keinen lokalen 30-Sekunden-Timeout mehr |
| 25 | **C mit Design-Review** — `feat(session-ui): show calendar-aware message timestamps` | `packages/session-ui/src/components/message-part.tsx`, `packages/session-ui/src/components/message-part.css` | fokussierte Tests für Tagesgrenzen und Locale ergänzen; UI-Änderung zuerst als Issue abstimmen |
| 26 | **D, abhängig von #22** — pausierbare Follow-up-Queue | `packages/app/src/pages/session.tsx`, `packages/app/src/pages/session/composer/session-followup-dock.tsx`, `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/de.ts` | erst nach Entscheidung zu #22; Queue-Logik, UI und Fork-Dock-Design sauber trennen und testen |
| 27 | **D mit Design-Review** — Startoverlay mit echtem Bereitschaftsfortschritt und Workspace-Skeleton | `packages/app/src/app.tsx`, `packages/app/src/components/app-startup-overlay.tsx`, `packages/app/src/components/app-startup-overlay.css`, `packages/app/src/components/workspace-skeleton.tsx`, `packages/app/src/components/workspace-skeleton.css`, `packages/app/src/pages/layout-new.tsx`, ausgewählte Hunks aus `packages/app/src/pages/session.tsx`, `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/de.ts` | als `workspace-readiness-ui`; layoutunabhängigen Bereitschaftsvertrag aus Fork-Shell und Zielsession-Auflösung lösen; UI-Screenshots und Start-/Reload-Tests erforderlich |
| 28 | **D mit Design-Review** — der neu gebaute mQorva-Seitenleisten-Arbeitsbereich mit Projektgruppen, separaten Chats, Anheften, Suche und verschiebbaren Entwürfen | `packages/app/src/app.tsx`, `packages/app/src/context/settings.tsx`, `packages/app/src/context/layout.tsx`, `packages/app/src/components/settings-v2/general.tsx`, `packages/app/src/components/titlebar.tsx`, `packages/app/src/pages/layout-sidebar/*`, `packages/app/src/pages/new-session.tsx`, `packages/app/src/pages/new-session/new-session-view.tsx`, `packages/app/src/context/tabs.tsx` (nur additives `unassigned`), `packages/app/src/context/tab-migration.ts` (nur dieses Merkmal), `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/de.ts` | bleibt ein eigenständiges mQorva-Feature und ist **nicht identisch** mit Upstreams vertikalen Tabs. Tab-Zustand, Auswahl, Navigation, Schließen und Sortierung bleiben Upstream-Verträge; die Sidebar liest sie nur und ersetzt im gewählten Layout ihre horizontale Darstellung |
| 29 | **C mit Design-Review** — schnelle Navigation zwischen Nutzereingaben in langen Sitzungen | `packages/app/src/pages/session/timeline/message-rail.tsx`, `packages/app/src/pages/session/timeline/message-rail.css`, `packages/app/src/pages/session/timeline/message-rail-text.ts`, `packages/app/src/pages/session/timeline/message-rail-text.test.ts`, ausgewählte Hunks aus `message-timeline.tsx` | eigenständiges, layoutneutrales Feature `session-navigation-ui`, zusammen mit #18/#19 und #25; an den geschlossenen Versuch `#38484` anknüpfen; responsive Darstellung, Scroll-Synchronisation und Screenshots ergänzen |
| 30 | **C/D mit Design-Review** — Markdown-Dateien wahlweise gerendert oder als Quelltext öffnen | `packages/session-ui/src/context/open-file.tsx`, `packages/session-ui/src/context/index.ts`, `packages/session-ui/src/components/markdown.tsx`, `packages/session-ui/src/components/markdown.css`, `packages/app/src/pages/session/markdown-preview.ts`, ausgewählte Hunks aus `file-tabs.tsx`, `session-side-panel.tsx` und `session.tsx` | als `markdown-file-preview`; Storage-Key neutralisieren; Dateilink-, Vorschau-, Fehler- und Persistenzfälle testen |
| 31 | **D mit Design-Review** — zusammenhängende Arbeitsfläche für Datei-/Review-Panel, Terminal und Composer | ausgewählte Hunks aus `packages/app/src/pages/session.tsx`, `packages/app/src/pages/session/file-tabs.tsx`, `packages/app/src/pages/session/session-side-panel.tsx`, `packages/app/src/components/session/session-header.tsx`, `packages/app/src/components/prompt-input-v2.tsx`, `packages/session-ui/src/v2/components/prompt-input/index.tsx`, `packages/ui/src/components/dock-surface.css` | aufteilen: sidebar-spezifische Anordnung gehört zum Vertrag #28; layoutneutrale Arbeitsflächenverbesserungen bilden erst nach Vergleich mit dem neuen `v2`-Session-Screen das eigene Feature `session-workspace-layout` |
| 32 | **C mit UI-Nachweis** — Permission-Aktionen optional innerhalb der gemeinsamen Prompt-Shell halten | `packages/session-ui/src/components/dock-prompt.tsx`, `packages/session-ui/src/components/dock-prompt.stories.tsx`, `packages/app/src/pages/session/composer/session-permission-dock.tsx`, zugehörige Permission-Regeln in `packages/session-ui/src/components/message-part.css` | eigenständiger Fix `permission-dock-layout`; das additive `footerInside` bleibt opt-in und darf Question-Docks nicht verändern; Story, schmale Breite, Umbruch und Fokuswege visuell prüfen |
| 33 | **C nach Vertragsprüfung** — dauerhafte Permission-Antwort anbieten, sobald die Anfrage `always`-Muster liefert | `packages/app/src/pages/session/composer/session-composer-state.ts` | eigenständiger Fix `persistent-permission-choice`; nicht an `protocol() === "v2"` koppeln, aber zuerst bestätigen, dass der V1-Request die `always`-Semantik tatsächlich unterstützt; beide Protokollpfade testen |
| 34 | **C mit Windows-Nachweis** — unverpackten Electron-Entwicklungsstart von der installierten Dev-App-ID trennen | `packages/desktop/src/main/index.ts`; neutraler Identitätsvertrag/Test nahe der Desktop-Konfiguration | veröffentlicht als PR #46474 mit Issue #46473 auf Branch `desktop-dev-identity`; der neutrale Test hält installierte IDs stabil und erzwingt eine eigene unverpackte AppUserModelID. Reproduktion im Fork: richtige und verwaiste Startmenü-Verknüpfung teilten eine AppUserModelID, die verwaiste Verknüpfung zeigte auf eine fehlende `electron.exe`, Taskleiste zeigte generisches Dokument-Icon. |

### Neue Integrationsnähte, keine direkten PR-Kandidaten

- `packages/app/src/utils/server-protocol.ts`: V2-Healthcheck vor dem Legacy-Healthcheck ist für den
  hybriden V1/V2-Fork erforderlich. Upstream braucht diese Protokollweiche in dieser Form nicht.
- `packages/app/src/pages/session/timeline/message-rail-text.ts`: Die Textaufbereitung ist neutral,
  wird derzeit aber ausschließlich vom mQorva-Message-Rail genutzt. Erst zusammen mit einem von
  Upstream gewünschten Rail-/Preview-Konzept herauslösen.

## D — vor einem PR trennen

- `utils/server-compat.ts`: produktneutraler Dispose-/OAuth-Teil (gehört zu #11) vom
  Location-Threading für verzeichnisbezogene Aufrufe (B) trennen.
- `prompt-input-v2.tsx`: Spinner-Fallback und `onSubmit(invert)` wären separat C; die
  `slotAfterControls`-Verlagerung der Context-Usage ist eine Design-Entscheidung (A).
- `session-header.tsx`: bedingungslose Projektauflösung über `activeSession().directory` wäre
  C-Fragment (`fix(app): resolve session header project from the active session`).
- `titlebar.tsx`: Hintergrundfarbe unter nativen Windows-Caption-Buttons wäre C-Fragment
  (`fix(app): paint titlebar background under native windows caption buttons`).
- `new-session/new-session-view.tsx`: Composer erst bei gewähltem Projekt (Tabs-Fallback) wäre
  C-Fragment.
- `interaction.ts` (session-ui): `hasContent()`-DOM-Fallback einzeln upstream-fähig;
  `invert` gehört jetzt zu Kandidat #22.
- `windows-app-menu.tsx`: `entries()`-Refactor ohne Verhaltensänderung — nur beiliegend.
- `home-sessions-view.tsx` / `message-timeline.tsx` Titellokalisierung: erst nach Klärung des
  Titel-Themas (#4) und mit Upstream-i18n statt Fork-i18n denkbar.

## Queue-Abweichung wird durch `v2` überholt

Auf `upstream/dev` existiert der Typ `followup: "queue" | "steer"`, aber drei Stellen erzwingen
weiterhin `steer`. Der Fork hat die Auswahl reaktiviert, sichtbar gemacht und Ctrl+Enter als
Umkehrer ergänzt. In `upstream/v2` ist Queue inzwischen selbst eine echte Einstellung mit eigenem
Queue-Panel und E2E-Tests. Damit ist #22 kein neues Upstream-Feature mehr. Nach Übernahme der neuen
App-Architektur wird nur noch semantisch verglichen, ob Ctrl+Enter-Inversion, Pausieren,
Drag-Reorder, Löschen oder Steer-Menü dort fehlen. Solche Restunterschiede wären kleine
Folgekandidaten und kein erneutes Gesamtpaket.

## Dokumentationslücken in `plans/upstream-patches.md`

Erledigt (Abschnitte 13–18 plus Marker 14a–18a in `patches.ps1` erfasst): message-timeline.tsx,
Follow-up-/Queue-Bündel, `tabs.tsx`/`tab-migration.ts`, Session-UI-Nähte,
`DEFAULT_SIDEBAR_WIDTH`. Übrig bleibt nur Abschnitt 18 (Icon-Discovery-Entfernung), den
`patches.ps1` wegen negativer Prüfung nicht sehen kann — nach jedem Sync von Hand kontrollieren.

## Tabs-Modus weicht an vier Stellen vom Upstream ab

Empfehlung: akzeptieren und dokumentieren (siehe Empfehlung 2). Der Umschalter funktioniert; die
Abweichungen sind produktneutrale Verbesserungen:

1. Draft-Seite (`pages/new-session.tsx`): eigener Header, Terminal, Workspace-Panel gelten
   bedingungslos; das Status-Popover im Titlebar-Rechtsmount ist entfernt.
2. `pages/session.tsx`: Terminal sitzt immer in voller Breite unten, nie mehr gestapelt neben dem
   Review-Panel.
3. `MessageRail` rendert ab Viewport ≥520×320 auch im Tabs-Modus.
4. Composer-Breite (`max-w-200`) und Context-Usage-Slot gelten für beide Modi.

## Zählung und Pflegezustand

Die Liste enthält 34 nummerierte Prüfthemen, aber keine 34 PRs. Die **Abarbeitungsliste:
PR-Pakete in Reihenfolge** weiter oben bündelt die unabhängigen Core-/Server-/Desktop-/
Permission- und Desktop-Korrekturen zu 10 PR-Paketen (Pakete 0–9: 8 veröffentlicht, 1 entfallen,
1 vorgemerkt). Hinzu kommen die
v2-abhängigen Pakete (v2-1 bis v2-7), die App-Fixes (`app-v1`) und die entfallenen Themen
(`followup-queue-controls`, `session-title-generation`). PR #46125 ist offen
(Branch `async-session-idle`, HEAD `763d4ca96d`, Basis `upstream/dev` `10765ff2a9`); PR #46023
ist der laufende Pilot (`auth-json-safety-pilot`, Basis `upstream/dev` `10765ff2a9`, HEAD `5b9bb8411c`); PR #46148
ist offen (Branch `filesystem-root-watch`, HEAD `46bcd01c49`, Basis `upstream/dev` `10765ff2a9`);
PR #46162 ist offen (Branch `init-safety`, Bündel #6+#7, HEADs `a856022bf7`, `85a2b3bdb2` und
`edd743a009`, Basis `upstream/dev` `10765ff2a9`); PR #46167 ist offen (Branch
`bootstrap-init-timeout`, HEAD `cc3fe65b0c`, Basis `upstream/dev` `10765ff2a9`); PR #46196 ist
offen (Branch `build-and-dev-flags`, Bündel #9+#21, HEADs `d93bd149da`, `a748a93544` und
`9fda3f7da1`, Basis `upstream/dev` `10765ff2a9`); PR #46302 ist offen (Branch
`persistent-permission-choice`, HEAD `a2beb0b98c`, Basis `upstream/dev` `10765ff2a9`);
PR #46305 ist offen (Branch `windows-zorder-reset`, HEAD `13bed544a9`, Basis
`upstream/dev` `10765ff2a9`). Am 30.08. wurden die älteren PRs
(auth-json-safety-pilot, async-session-idle, init-safety, filesystem-root-watch,
bootstrap-init-timeout, build-and-dev-flags) per rebase + --force-with-lease
von `dc4449df0d` auf `10765ff2a9` nachgezogen.
Die Korrekturen #32 und #33 bleiben zwei getrennte Permission-Verträge, obwohl sie im Fork
gemeinsam committed wurden. Die großen UI-Themen sind keine Kopie der Upstream-Arbeit, müssen
ihre Überschneidungen mit `v2` aber vor der Extraktion ausdrücklich abgrenzen.

Vor jedem konkreten PR gilt der aktuelle Diff `upstream/dev..dev` als Quelle der Wahrheit. Für
App-Änderungen kommt der Vergleich mit dem dann aktuellen `upstream/v2` als Architektur-Gate hinzu.
Ein Eintrag in dieser Liste ist eine Prüfspur, keine Freigabe zum ungeprüften Übernehmen oder Senden.
