# Snapshot-Revert-Sperren: Datenverlust durch Revert verhindern

## Ausgangslage

Vier zusammenspielende Defekte in `packages/opencode/src/snapshot/index.ts` haben in einem
fremden Run Verlust von Dateien verursacht (85 Dateien aus `branding/`/`website/` in der
Patch-Liste, 421 unbeabsichtigte Löschungen):

1. **Patch-Liste zu breit** — `patch()` (Zeile ~349, jetzt ~421) stagt per `add()` den
   gesamten Worktree-Delta und liest `git diff --cached --name-only <hash>`. Fremde
   Änderungen anderer Sessions/Editoren seit dem Snapshot landen in der Patch-Liste.
2. **Store worktree-global, nicht session-lokal** — `gitdir = snapshot/<projectID>/<hash(worktree)>`
   (Zeile ~71). Kein Owner-/Generationsmerkmal; ein Revert kann so gegen den Tree
   eines anderen Runs (dort: 07883534 vs 62dfe9b4) zurückrollen.
3. **Fehlende Dateien hart löschen** — `remove()` = `fs.remove` ohne Rückfrage, ohne
   Deckel, ohne Trockenlauf (Zeile ~441 und Batching ~516). 421-mal in fünf Sekunden.
4. **Diff/DiffFull unbegrenzt** — `structuredPatch` mit `context: Number.MAX_SAFE_INTEGER`,
   Blobs per `cat-file --batch` ins Speicher, keine Yield-Punkte; OOM und blockierter
   Server-Loop. `limit` (2 MiB) wird beim Staging genutzt, nicht in diffFull.

## Entscheidungen

- **Kein Papierkorb.** Nach Fix 1 sind Löschkandidaten nur noch Dateien, die die Session
  gemeldet hat und die nicht im Ziel-Snapshot existieren. Das Löschen ist dann korrekte
  Revert-Semantik, nicht versehentliche Zerstörung. Ein Papierkorb würde die Undo-
  Semantik undokumentiert verwässern (Sinn: Undo stellt die Session-Datei wieder her,
  entfernt aber Dateien, die der Session-Deployment angelegt hat). Der Papierkorb wäre
  nur ein weiterer Unbekannter für Fälle, die Punkt 1 ausschließt.
- **Kein Merge der zwei offenen PRs:** `#43455` (circuit breaker) hat nachweisbar einen
  Regression-Bug (add() → `return` als Bool-Semantik, `track()` liefert `undefined` bei
  „keine Änderungen"; bewiesen durch 8 Test-Fails). `#45141` (Subdir-Restore-Scope) ist
  sauber, deckt aber nur die Subdir-Variante von Punkt 1/2, nicht den Tool-Filter.
  Die saubere Restore-Scope-Verbesserung daraus wird 1:1 übernommen.
- **Scope allein reicht nicht:** Die vier Punkte sind zusammen zu behandeln; Fix 1+3
  sind die Ursache des Datenverlusts, 2 Verstärker, 4 Folge.

## Umsetzung

### A. Tool-basierte Patch-Dateiliste (Punkt 1)

- Irgendwo an dem Durchlauf des Tool-Aufrufs (write/edit/patch/…) die gemeldeten Dateien
  der Session sammeln (vermutlich im `processor`/`session`-Context, in dem `patch()`
  aufgerufen wird).
- `patch()` direkt auf diese Dateimenge beschränken (statt `diff --cached --name-only`),
  sowie beim Diff denselben Filter.
- Fallback für Fälle ohne Tool-Meldung konservativ: keine neue Patch-Liste aus dem
  Worktree, sondern `[]`.

### B. Ownership-/Generationskennung (Punkt 2)

- Store pro (project, worktree, session/run-generation) trennen ODER ein Owner-/Generation-
  Merkmal in `gitdir` (Datei anführen).
- `revert(patches)` weigert, wenn seit dem Ziel-Snapshot ein fremder Run `track()`
  geschrieben hat (Owner/IPC, Generationsnummer). Abbruch mit Hickel statt
  Still-Durchlauf.

### C. Lösch-Deckel statt Papierkorb (Punkt 3)

- Löschen nur für Dateien aus der Tool-Liste (A).
- Obergrenze (konfigurierbar, Default z. B. 100 Dateien pro Revert) — Überschreitung
  bricht den Rest des Reverts ab und loggt.
- Kein `remove` für Dateien, die die Session nie angefasst hat; das Pfad-Präfix/relative
  Pfad gegen die Tool-Liste prüfen.

### D. Diff begrenzt und unterbrechbar (Punkt 4)

- `structuredPatch` Kontext auf kleine Werte deckeln.
- Dateien über `limit` ohne Patch (nur Metadaten) ausliefern.
- Gesamtbudget für Patch-Bytes (konfiguriert), Kappung bei Überschreitung.
- Schleife (`diffFull`) zwischen Batch-Gruppen unterbrechbar machen
  (`Effect.yield`, `Effect.requestBlocking` oder eine kleine Sleep-0-Pause),
  damit der Server-Loop nie dauerhaft blockiert.

## Tests

- Regression-Test: Änderungen einer fremden Datei zwischen Snapshots erscheinen nicht in
  der Patch-/Diff-Liste und werden beim Revert nicht angerührt.
- Undo-Test: ein fremder Run zwischen Ziel-Snapshot und Revert blockiert den Revert.
- Lösch-Deckel-Test: Überschreitung bricht ab, nichts gelöscht.
- Bestehende Snapshot-Tests grün; der `add()`-`undefined`-Pfad darf nicht mehr auftreten
  („track mit keine Änderungen" liefert weiterhin den Hash).

## Nicht enthalten

- Kein „v2-Mutation-Epoch"-Neuaufbau (upstream #44511) — der Min-Fix reicht, um die
  akuten Verluste zu stoppen.
- Keine Migration des Snapshot-Stores.
- Kein Papierkorb (Begründung oben).

## Umsetzungsstand (2026-09-08)

Alle vier Punkte sind auf `packages/opencode/src/snapshot/index.ts` + Aufrufern umgesetzt:

- **A (Tool-basierte Patch-Liste):** `patch(hash, files?)` — `files` optional. Produktion
  (`session/processor.ts`) sammelt pro Turn die von `completeToolCall` gemeldeten Pfade
  (`write`/`edit`/`apply_patch`-Metadaten bzw. `filePath`-Input) und übergibt sie; der
  Patch-`diff` wird per Pathspec auf diese Liste begrenzt. Ohne gemeldete Dateien bleibt
  der Aufruf breit (Debug-CLI, Tests) bzw. leer (leere Liste = keine Dateien).
- **B (Ownership):** `track(owner?)` schreibt ein Owner-Ledger (`owner-log.json` im
  gitdir). `revert(patches, owner?)` verweigert, sobald nach dem Ziel-Snapshot ein
  fremder Owner getrackt hat. Produktions-`SessionRevert` übergibt `sessionID`.
  Legacy-Stores ohne Ledger bzw. unbekannte Hooks bleiben zugänglich (kein Refus).
- **C (Lösch-Deckel):** `maxDeletions = 100`; Übersteigerung bricht den Revert ab
  (kein Durchdelegieren). Kein Papierkorb; Löschkandidaten sind durch A bereits auf
  die gemeldeten Dateien begrenzt.
- **D (Diff begrenzt):** `diffContext = 3`, Dateien über `limit` ohne Patch-Body,
  Gesamtbudget `patchBudget` (2 MiB), `yield* Effect.yieldNow` pro 100er-Batch.
- **Restore-Scope (#45141)** auf das Session-Verzeichnis übernommen.

Abweichungen vom Plan: Deckel/Kontext/Budget sind Modul-Konstanten (noch nicht in der
Config), der Fallback-Modus mit `patch(hash)` ohne Dateiliste bleibt aus Kompatibilität
(CLI/Tests) erhalten, und für Alt-Stores ohne Ledger wird die Ownership-Prüfung
abgemildert statt zu blockieren.

### Tests

- `test/snapshot/snapshot.test.ts`: 57 grün (inkl. 4 neuen Regressionstests:
  Patch-Einschränkung, leere Tool-Liste, Ownership-Refus, Deletions-Budget).
- `test/session/revert-compact.test.ts`: 8 grün (Tracks jetzt mit `sessionID`-Owner,
  spiegelbildlich zur Produktion).
- `test/session/prompt.test.ts` (Tool-Ausführung): Stichproben grün.

### PR-Frage

Drei offene upstream-ISSUEs werden adressiert: #40736 (Cross-Session-Diff-Leak auf
dem Legacy-Pfad), #33940 (Undo macht alles rückgängig), #46783 (UNDO löscht fremde
Datei). PR #45141 (Restore-Scope, dev-basiert) ist ein Teil davon und wurde hier
1:1 übernommen. Der Changeset zielt auf den weiterhin verdrahteten OpenCode/
`SessionPrompt`-Pfad; die neue Core-V2-Snapshot-API (`packages/core/src/snapshot.ts`)
ist bereits Datei-selektiv und braucht diese Härtung nicht. PR-Arbeit siehe
`upstream-pr`-Skill (Fork-Layout mit `### Fork`-Sektion).