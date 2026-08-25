# Klassisches Interface abziehen — mQorva nur in der neuen UI-Variante

Datum: 25.08.2026 · Autor: Ronny · Repo: `D:\Coding\OpenCode` (mQorva-Fork)

## 1. Ausgangslage & Abgrenzung

Der Fork trägt **zwei UI-Stränge**:

- **Klassisches Interface („V1")**: `newLayoutDesigns === false`; Pfade `pages/layout/*`, `prompt-input.tsx`, `settings-general.tsx`. Das ist der **OpenCode-Basispfad**.
- **Neues Design**: `newLayoutDesigns === true`, mit zwei Modi:
  - **Tab-Modus** — Upstream-Standard des neuen Designs (bleibt).
  - **Seitenleisten-Modus** — mQorva-Zusatz (`pages/layout-sidebar/*`, `prompt-input-v2.tsx`, `settings-v2/*`).

**Ziel des Forks:** Basis = **OpenCode + dein Sidebar-Modus**.
- Das klassische Interface bleibt als OpenCode-Repräsentation, aber **ohne mQorva-Änderungen** → mQorva-Änderungen dort werden auf den Upstream-Stand zurückgeführt; dort wird nie wieder entwickelt.
- Im neuen Design bleibt beides: **Tab-Modus (Upstream) + Seitenleisten-Modus (mQorva)**, umschaltbar über `layoutMode` (tabs ↔ sidebar).
- **Alle künftigen Änderungen nur in der neuen UI-Variante.**

## 2. Zielbild

| Aspekt | Ziel |
|---|---|
| Klassisches Interface (V1) | OpenCode-Stand; alle mQorva-Änderungen zurückgenommen; kein weiterer Umbau |
| Neues Design | Tab-Modus (Upstream) **und** Seitenleisten-Modus (mQorva) |
| Umschalter layoutMode | bleibt aktiv (tabs ↔ sidebar) |
| mQorva-Entwicklung | nur in den neuen Pfaden (`layout-sidebar/*`, `prompt-input-v2.tsx`, `settings-v2/*`) |
| Gemeinsame Logik (i18n, utils, context) | teilen, aber nur wenn produktneutral; sonst V2-Zweig |
| API | V1-Transport bleibt intern kompatibel; App spricht V2; keine neuen Features auf V1 |
| Upstream | gelöschte/reduzierte V1-Dateien beim Sync von `opencode/dev` übernehmen statt selbst pflegen |

## 3. Vorgehen (Phasen)

### Phase 0 — Regeln verankern (sofort)
- In die Root-`AGENTS.md` aufnehmen (erledigt):
  - **mQorva baut neue UI-Funktionen nur in der neuen UI-Variante** (`layout-sidebar/*`, `prompt-input-v2`, `settings-v2`, `newLayoutDesigns()===true`-Zweige). Keine mQorva-eigenen Features für V1.
  - **Kleine, nicht-brechende Fixes dürfen V1 berühren** (Bugfixes/Layout-Papercuts ohne mQorva-only-Verhalten) — V1 bleibt OpenCode-kompatibel.
  - `layoutMode` (tabs ↔ sidebar) bleibt umschaltbar; Tab-Modus ist Upstream-Standard und bleibt.
  - **Neue Features nur auf der V2-API** bauen; kein V1-API-Pendant.
- `plans/retire-v1-interface.md` als Referenz behalten.

### Phase 1 — mQorva-Änderungen im klassischen Interface zurücknehmen
Gezielt die Diff-Stellen gegen `opencode/dev` prüfen (Basis-Referenz: `git diff dev -- packages/app`), nur mQorva-spezifische Änderungen reverten:
- `utils/session-title.ts` / `utils/session.ts` (Platzhalter, `isNewChat`) → nur den klassischen Zweig (z. B. `sidebar-items.tsx`) auf Upstream zurück; die neuen Pfade behalten die mQorva-Version.
- Alle `newLayoutDesigns`-Äste **im klassischen Code**, die mit gesetzt sind → dem Upstream-`false`-Verhalten angleichen bzw. mQorva-Teil entfernen.
- `settings-general.tsx`-Zusätze (z. B. neue Zeilen) → entfernen; Settings-Umbau lebt nur in `settings-v2`.
- Resultat: `packages/app/src/pages/layout/*`, `prompt-input.tsx` und `settings-general.tsx` = OpenCode-Stand.
- Verifikation: `git diff dev` für diese Ordner so leer wie möglich; typecheck.

### Phase 2 — Klassisches Interface von weiterem mQorva-Zuwachs entkoppeln
- Sicherstellen, dass neue Features die klassischen Dateien nicht mehr berühren (Regel aus Phase 0).
- Wo Klassen/Funktionen produktneutral sind, im `upstream.ts`-Stil (Seam) lassen; wo mQorva-spezifisch, nur in den neuen Pfaden.

### Phase 3 — neue UI-Variante = Entwicklungspfad
- Sicherstellen, dass `layoutMode`-Toggle tabs/sidebar **beide** Teile des neuen Designs durchgängig rendern.
- Dokumentation/README: „mQorva = OpenCode + Seitenleisten-Modus; Entwicklungszweig ist das neue Design."

### Phase 4 — tote mQorva-Flags im klassischen Pfad aufräumen
- MQorva-spezifische Flags/Logik, die nur das klassische Interface nutzte, entfernen.
- `newLayoutDesigns`-Schalter bleibt im neuen Design als Umschalter in den klassischen Modus erhalten — erst wenn das klassische Interface stabil beim Upstream ist, optional ganz ausblenden.

### Phase 5 — Upstream-Rückführung (laufend)
- Bei jedem Upstream-Sync das klassische Interface unangetastet von `dev` übernehmen.
- Rest-Delta: nur neue-UI-Pfade + Packaging (`package.ps1`/`build.ps1`).
- `git diff dev` bleibt review-freundlich und klein.

## 4. API: V1 vs V2

- **App-Ebene**: Die App spricht ab jetzt nur die **V2-API**.
- **Transport-Ebene** (`protocol === "v1"`-Zweige im Server/Sidecar): bleibt bestehen, **nur** um ältere Server zu bedienen, wird aber nicht mehr erweitert.
- **Regel**: Neue Funktionen → nur auf V2. Kein `v1`-Pendant dazu schreiben.
- Im Code: `protocol`-Prüfungen nur noch dort, wo Kompatibilität wirklich nötig ist (nicht in neuen Features, nicht in der UI).

## 5. Testen & Verifikation

- **`bun typecheck`** nach jeder Phase (Reihenfolge: `core`, `opencode`, `app`, `desktop`, `session-ui`, `ui`).
- `bun test` für betroffene Tests (`session.test.ts`, `layout-mode.test.ts`, `settings`-bezogene, Sidebar-`sessions.test.ts`, `session-input`-Tests).
- **Manuell**: `bun dev web` via separatem Backend (`packages/opencode` auf Port 4096, `packages/app` auf 4444) für UI-Smoke; danach `.\build.ps1` + `.\package.ps1` für die Desktop-Verteilung.
- Regressionsschwerpunkt: Chat senden/queue, Sidebar (Pin/Unread/Spinner), Settings (alle Zeilen sichtbar), Fenster-Z-Order (voriger Fix bleibt), Follow-up-Dock.

## 6. Risiken & Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| V1-Pfade werden noch von einem Feature genutzt, das V2 nicht hat | Phase 2 einzeln pro Komponente; vor jedem Löschen prüfen, ob V2-Pendant Feature-parität hat |
| Upstream-Sync überschreibt V2-Anpassungen | mQorva-Delta dokumentieren (Phase 5) und in separaten Ordnern halten (`layout-sidebar/*`, `settings-v2/*`) |
| Tests decken V1 ab und brechen | Tests gezielt auf V2-Pfade umziehen; V1-Snapshot-Tests entfernen |
| Große Dateien (`session.tsx`, `settings.tsx`) bleiben unübersichtlich | Phase 1 zuerst, in kleinen, einzeln type-checkenden Schritten |
| Verhaltensänderungen im neuen Design durch Entfernen des V1-Zweigs | Parität vor Löschen prüfen; Smoke-Test nach jedem Schritt |

## 7. Definition of Done

- [x] mQorva-Änderungen im klassischen Interface (V1) auf OpenCode-Stand zurückgeführt (`git diff dev` für `pages/layout/*`, `prompt-input.tsx`, `settings-general.tsx` minimal)
  - `prompt-input.tsx`, `settings-general.tsx`, `pages/layout/*` = `upstream/dev`.
  - `settings.tsx` trägt nur noch beide bewussten Fork-Punkte: `layoutMode` (Seitenleiste) und die global freigegebene `followup`/Queue.
  - `message-timeline.tsx`: Kosten-Kreis wieder im klassischen Header-Zweig (keine V1-Regression); neue-Design-Details scoped.
- [x] Tab-Modus (Upstream) und Seitenleisten-Modus (mQorva) beide funktionsfähig, `layoutMode`-Umschalter aktiv
- [x] Neue Entwicklungsregel in AGENTS.md: mQorva ändert nur die neue UI-Variante, keine V1-Entwicklung, Features nur auf V2-API
- [x] Neue Funktionen seit Regel-Setzung nur in neuen Pfaden umgesetzt
- [x] API: neue Features treffen nur V2; V1 nur noch interne Kompatibilität im Transport
- [x] `bun typecheck` grün in allen betroffenen Packages
- [~] Smoke-Test: manuell via `bun dev web` + `.\package.ps1` (steht aus; Screenshots der Core-Szenarien in der Release-Note)

## 8. Umsetzungsnotizen (25.08.2026)

- **Phase 1 abgeschlossen**: V1-Dateien auf `upstream/dev` zurückgesetzt. Die Queue-/Strg+Enter- und Titel-Platzhalter-Features sind übergreifend und bleiben global (kein künstlicher V1-Guard).
- **Phase 3**: `layout-sidebar/README.md` um den mQorva-Entwicklungsregel-Abschnitt ergänzt.
- **Phase 4**: kein toter mQorva-Flag mehr im klassischen Pfad; `withTimestampedFallback` vollständig entfernt.
- **Bekannt (vorbestehend)**: `bun test` für `layout-sidebar/sessions.test.ts` und `layout-mode.test.ts` scheitert mit `Export named 'use' not found in module 'solid-js/web/dist/server.js'` — ein Bun-Test-Umgebungsproblem beim Laden der Solid-SSR-Build über den `upstream.ts`-Seam. Der Seam existiert seit den mQorva-Commits; die Fehler sind unabhängig von den heutigen Änderungen (nicht Teil dieses Plans; separat zu klären).