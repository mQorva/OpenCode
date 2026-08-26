# Upstream-Klassifizierung des Fork-Diffs (`upstream/dev..dev`)

Bestandsaufnahme aller Fork-Änderungen gegenüber `anomalyco/opencode`: Was ist eigen, was ist Naht,
was kann zurück ans Original? Grundlage für künftige Upstream-PRs und für die Pflege von
`plans/upstream-patches.md`. Erstellt nach dem Upstream-Sync auf `1cc53890dc`.

## Empfehlungen in Reihenfolge

1. **Patch-Dokument nachziehen — erledigt**: `message-timeline.tsx`, Follow-up-/Queue-Bündel,
   `tabs.tsx`/`tab-migration.ts` und Session-UI-Nähte sind jetzt als Abschnitte 13–17 in
   `plans/upstream-patches.md` mit Markern 14a–18a in `patches.ps1` erfasst; alle 48 Marker
   grün. Übrig bleibt nur die negative Prüfung Icon-Discovery (Abschnitt 18, von Hand).
2. **Tabs-Abweichungen akzeptieren und dokumentieren** — erledigt: Abschnitt „Sichtbare
   Abweichungen im Tab-Modus" in `plans/upstream-patches.md`. Alle vier Stellen sind
   Verbesserungen, die auch im Tab-Modus funktionieren; der Umschalter bleibt voll bedienbar.
3. **Queue→Steer-Feature als Upstream-Kandidat #22 behandeln**: kein Fork-Eigensinn, sondern ein
   reaktiviertes, verbessertes Upstream-Setting; Dokumentation steht (Abschnitt 13).
4. **Ersten Upstream-PR als Pilot aufsetzen**: `fix(opencode): serialize and atomically write
   auth.json` — klein, UI-frei, Concurrency-Test liegt bereits vor. Zweig von `upstream/dev`
   abschneiden, nie vom mQorva-`dev`.
5. **Danach Backend-Kandidaten 2–10 einzeln folgen lassen**, dann App-Cluster (#11 zuerst als
   Infrastruktur-PR, dann Vertrag + UI-Stellen).

## Kategorien

- **A — mQorva-eigen**: Editionsidentität, Shell, Buildmodell. Bleibt im Fork.
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
| 10 | `test(server): add end-to-end user journey test` | `opencode/test/server/complete-user-journey.test.ts` | ist selbst Test |

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
| 22 | `feat(app): restore selectable follow-up queue behavior with ctrl-enter inversion` — Upstream kennt `followup: "queue" \| "steer"`, zwingt `"queue"` aber an drei Stellen auf `"steer"`; der Fork lässt beide Werte zu, macht die Auswahl sichtbar und Strg+Enter zum Gegenteil der Vorgabe | `context/settings.tsx`, `components/settings-v2/general.tsx`, `prompt-input/submit.ts`, `session-ui/.../interaction.ts`, `i18n/en+de.ts` | `submit.test.ts` (Invert-Fall ergänzen); dokumentiert als Patch-Abschnitt 13 |

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

## Keine bewussten Divergenzen mehr

Ursprünglich galt die Rücknahme der queue→steer-Erzwingung als Fork-Eigenheit. Korrekt ist: Upstream
hat das Setting `followup` samt Typ gebaut, die Queue-Auswahl aber unerreichbar gemacht (drei
Umzwing-Stellen in `context/settings.tsx`). Der Fork hat diese Stellen entfernt, die Auswahl in den
Einstellungen sichtbar gemacht und Strg+Enter als Umkehrer ergänzt — beides Verhalten, das das
Original ebenfalls anbieten könnte. Einstufung daher als Upstream-Kandidat #22, nicht als Divergenz.
Das zugehörige Dock-Redesign (`session-followup-dock.tsx`: Drag-Reorder, Löschen, Steer-Menü)
bleibt davon getrennt betrachtet: Kern als Enhancement (#22-Beilage möglich), Design als mQorva.

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

## Zählung

App-Kern: A 2 · B 5 · C 8 · D 5 — App-Komponenten/Seiten: A 1 · B 13 · C 6 · D 9 —
Session-UI/Core/Server/TUI: B 3 · C 11 · D 1 — Desktop: A 7 · B 6 · C 1 · D 3.

Gesamt: rund 22 abgrenzbare Upstream-Kandidaten, davon 10 Backend (höchste PR-Chance, geringstes
Konfliktrisiko). Kein einziger C-Kandidat referenziert `layoutMode`, Sidebar oder Edition.
