# Plan: md-Dateien im Chat — Ladefeedback, Panelbreite, Kontextmenü

Drei gemeldete Probleme im Chat-Bereich der Desktop-App. Alle drei sind reproduzierbar
aus dem Code herleitbar; die Ursachen sind unten je Abschnitt benannt.

## Stand

Umgesetzt: Abschnitt 2 vollständig, Abschnitt 1 Stufe A, Abschnitt 3 vollständig.

Offen: Abschnitt 1 Stufe B (fehlende Datei melden — berührt das Protokoll) und Stufe C
(messen, danach ggf. blockweises Rendern). Nicht visuell verifiziert: `packages/app` mountet
im Browser ohne Electron-Shell und ohne laufenden opencode-Server nicht, die Änderungen
sind nur über Typecheck und Tests abgesichert.

Nebenbefund, außerhalb des Auftrags: `hr.ts`, `hu.ts`, `is.ts` und `lt.ts` ordnen ihre
Desktop-Menü-Texte über die Array-Position zu, und diese Zuordnung ist seit längerem um
zwei Stellen verrutscht — im Kroatischen heißt „Kopieren" derzeit „Ponovi" (Wiederholen).
Eigene Aufgabe, hier nur nicht verschlimmert.

## 1. Klick auf eine md-Datei: „erst passiert eine Weile nichts"

### Ursache

`packages/app/src/pages/session.tsx:457`

```ts
const openChatFilePath = async (input: string) => {
  const path = file.normalize(input.replace(/\\/g, "/"))
  if (!path) return
  await file.load(path)                 // ← wartet auf den kompletten Dateiinhalt
  if (!file.get(path)?.loaded) return
  openPaletteFile(path)                 // ← erst hier öffnet das Panel
}
```

Das Panel wird **nach** dem Laden geöffnet. Bis dahin gibt es keinerlei Rückmeldung —
kein Tab, kein Spinner, nichts. Der bereits vorhandene Ladezustand in
`file-tabs.tsx:508` bzw. `:806` (`common.loading`) wird dadurch nie sichtbar, weil der
Tab zu diesem Zeitpunkt noch gar nicht existiert.

Zum Vergleich: `createCommandPaletteFileOpener` (`components/command-palette.ts:70`)
öffnet den Tab sofort und lädt parallel — die Kommandopalette verhält sich also bereits
richtig. Nur der Chat-Pfad wartet.

Und: schlägt das Laden fehl, passiert sichtbar gar nichts — es bleibt beim Toast aus
`setLoadError`. Kein Tab, keine Fehlerstelle.

### Zwei Annahmen, die der Code nicht hergibt

**Eine Existenzprüfung vorab ist heute nicht billig — und das `await` ist auch keine.**

Der Server-Handler `/file/content`
(`packages/opencode/src/server/routes/instance/httpapi/handlers/file.ts:100`):

```ts
if (!(yield* FSUtil.Service.use((fs) => fs.existsSafe(file)))) return { type: "text" as const, content: "" }
```

Eine fehlende Datei liefert **HTTP 200 mit leerem Inhalt**, keinen Fehler. `file.load`
setzt daraufhin `loaded: true`, die Wächterzeile `if (!file.get(path)?.loaded) return`
greift nie. Das heißt: **schon heute** öffnet ein Klick auf Inline-Code, der nur wie ein
Pfad aussieht, einen Tab — nur eben nach der Wartezeit und mit einer leeren Datei
statt einer Meldung. Das `await` schützt vor nichts, es kostet nur.

Eine echte Vorabprüfung bräuchte einen zweiten Roundtrip: `file.list` auf das
Elternverzeichnis. Diese Route parst serverseitig zusätzlich `.gitignore` und `.ignore`
(`handlers/file.ts:66–92`) — sie ist teurer als das Lesen der Datei selbst. Damit würde
der Normalfall (Datei existiert) **doppelt so lange** dauern wie heute. Genau das
Gegenteil des Ziels.

Der bessere Weg ist, die Antwort im selben Roundtrip eindeutig zu machen: der Handler
soll bei fehlender Datei nicht `content: ""` liefern, sondern das Fehlen melden.

**Progressives Nachladen des Textes gibt es nicht — progressives Rendern schon.**

Transport: `/file/content` ist ein einzelner JSON-Response
(`groups/file.ts:141`, `success: LegacyContent`). Kein Chunking, kein SSE. „Den Anfang
sehen, während der Rest lädt" wäre eine neue Streaming-Route plus Client-Anbindung —
für lokale Dateien über localhost mit hoher Wahrscheinlichkeit Aufwand ohne messbaren
Gewinn.

Rendern: hier passiert das Gewünschte bereits. `Markdown` startet mit
`initialValue: initialResult(...)` (`markdown.tsx:504`). Bei Cache-Fehltreffer erzeugt
das über `fallback()` (`markdown.tsx:67`) sofort den **rohen Text** mit Zeilenumbrüchen,
sichtbar im selben Frame; die formatierte Fassung ersetzt ihn, sobald der Worker fertig
ist. Der Container ist also nicht leer — meine ursprüngliche Aussage oben war falsch.

Einschränkung dabei: `completedProjection` (`markdown-projection.ts:3`) packt die
gesamte Datei in **einen** Block. Der Worker-Job ist damit alles-oder-nichts pro Datei.
Der Chat-Pfad kann das besser (`streaming`-Prop → `projectMarkdown(live)`, blockweise) —
diese Maschinerie ließe sich für große Dateien nachnutzen, ist aber ein eigener Schritt.

### Änderung

**Stufe A — das eigentliche Problem (klein, behebt die Beschwerde)**

1. `openChatFilePath` entblocken — Tab und Panel sofort, Laden parallel:

   ```ts
   const openChatFilePath = (input: string) => {
     const path = file.normalize(input.replace(/\\/g, "/"))
     if (!path) return
     openPaletteFile(path)   // öffnet Tab + Panel und ruft file.load selbst auf
   }
   ```

   `openPaletteFile` (`components/command-palette.ts:70`) lädt bereits selbst; ein
   zweiter Aufruf entfällt. Danach ist der Chat-Pfad identisch zur Kommandopalette.

2. Ladezustand sichtbar machen: in beiden Zweigen von `file-tabs.tsx`
   (`SessionFileView:508`, `SessionFileViewV2:806`) den Text `common.loading` durch
   `LoaderV2` (v2) bzw. `Spinner` (v1) ersetzen, zentriert, Text daneben.

3. Spinner bis zum fertigen Rendern stehen lassen. Da der Rohtext sofort erscheint, ist
   das kein leerer Bildschirm mehr, sondern ein Hinweis „wird noch formatiert". Dafür
   ein optionales `onRendered` in `Markdown` ergänzen — im `createEffect`, der die
   Blöcke in den Container schreibt (`markdown.tsx:516`), gefeuert sobald
   `html.state === "ready"`. Anzeige: kleiner Spinner in der Panel-Toolbar neben dem
   Vorschau-Auge, nicht über dem Text — der ist ja schon lesbar.

**Stufe B — fehlende Datei ehrlich melden (ein Roundtrip, kein zusätzlicher)**

4. `LegacyContent` um ein Feld erweitern, z. B. `missing: Schema.optional(Schema.Boolean)`,
   und im Handler bei `!existsSafe` `{ type: "text", content: "", missing: true }`
   zurückgeben. Alternative wäre ein 404 — das Feld ist aber verträglicher, weil
   `LegacyContent` auch von `review-tab.tsx:58` und `review-panel-v2.tsx:105` gelesen wird
   und ein 404 dort neue Fehlerbehandlung erzwingen würde.
5. `file.load` (`context/file.tsx:170`) setzt bei `missing` statt `setLoaded` einen
   `setLoadError` mit einem neuen Schlüssel `error.file.notFound`. Der Fehlerzweig in
   `file-tabs.tsx:510` rendert ihn dann im Tab.
6. Danach im Fehlerfall den Tab wieder schließen, sofern er noch Vorschau ist
   (`tabs().preview`). Ein Klick auf vermeintlichen Pfad-Text hinterlässt so nichts.

**Stufe C — nur nach Messung**

7. Vor jeder weiteren Optimierung messen, wo die Sekunden tatsächlich liegen: Zeitstempel
   um `sdk().client.file.read` in `context/file.tsx:184` und um den `html`-Resolve in
   `markdown.tsx`. Verdacht: der Shiki-Worker (`markdown.worker.ts`, `bundledLanguages`,
   serielle Queue in `markdown-worker-queue.ts`), nicht der Transport.
8. Erst wenn die Messung den Worker bestätigt: blockweise Projektion auch für Dateien
   (`completedProjection` durch die Streaming-Projektion ersetzen), damit lange Dokumente
   abschnittsweise formatiert erscheinen.
9. Eine Streaming-Route für Dateiinhalte nur, falls die Messung den Transport belastet.
   Nach heutiger Codelage unwahrscheinlich.

### Betroffene Dateien

- `packages/app/src/pages/session.tsx` (openChatFilePath)
- `packages/app/src/pages/session/file-tabs.tsx` (beide Ladezustände, renderFile)
- `packages/session-ui/src/components/markdown.tsx` (`onRendered`)
- `packages/app/src/pages/session/session-side-panel.tsx` (Spinner in der Toolbar)
- Stufe B zusätzlich: `packages/opencode/src/server/routes/instance/httpapi/groups/file.ts`,
  `.../handlers/file.ts`, `packages/app/src/context/file.tsx`, `i18n/en.ts`, `i18n/de.ts`,
  danach `bun run generate` in `packages/client` (SDK-Typen)

---

## 2. Markdown-Text im Seitenpanel bleibt schmal

### Ursache

`packages/app/src/index.css:156`

```css
/* Markdown-Vorschau im Dateipanel: gleiche Textbreite und -abstände wie im Verlauf. */
.mqorva-markdown-file-view [data-component="markdown"] {
  max-width: 80ch;
}
```

`ch` hängt nur an der Schriftgröße, nicht am Container. Die Kappung liegt damit fest bei
rund 640–700 px — egal wie breit das Panel gezogen oder das Fenster gemacht wird.
Die Markdown-Komponente selbst ist `max-width: 100%` (`markdown.css:12`), das Panel-Layout
reagiert korrekt auf Fenstergrößen (`session.tsx:566`, `createResizeObserver` +
`clampSessionPanelWidth`). Die mQorva-Regel ist die einzige Bremse.

### Änderung

Regel entfernen. Der Text füllt dann die Panelbreite abzüglich der vorhandenen
Innenabstände (`px-6` am Wrapper in `file-tabs.tsx:455`/`:745`).

Der Kommentar über der Regel („gleiche Textbreite wie im Verlauf") beschreibt die
ursprüngliche Absicht — die entfällt bewusst: im Verlauf ist die Kappung sinnvoll, weil
dort Fließtext gelesen wird; im Dateipanel liest man ein Dokument, das die zugewiesene
Breite nutzen soll.

**Nebenwirkung:** Auf einem sehr breiten Panel (ultrawide, Panel > ~1400 px) werden die
Zeilen lang. Falls das später stört, ist der Umschalter „Lesebreite" neben dem
Vorschau-Auge in der Toolbar (`session-side-panel.tsx:729`) die naheliegende Ergänzung —
gleiches Muster wie `markdownPreview` in `pages/session/markdown-preview.ts`. Nicht
Teil dieses Plans.

### Betroffene Dateien

- `packages/app/src/index.css`

---

## 3. Kontextmenü im Thread: Standard-Optik, englische Strings

### Ursache

`packages/desktop/src/main/index.ts:114`

```ts
contextMenu({ showSaveImageAs: true, showLookUpSelection: false, showSearchWithGoogle: false })
```

`electron-context-menu` baut ein natives Chromium-Menü. Das erklärt beides:
die fremde Optik **und** die englischen Labels — die Bibliothek liefert nur Englisch,
und `options.labels` wird hier nicht gesetzt.

Wichtig für die Einordnung: die deutschen Strings der App selbst sind vollständig.
Ein Abgleich `en` gegen `de` ergibt **0 fehlende Schlüssel**; die Menüwörter existieren
sogar schon für den nativen Pfad (`i18n/de.ts:1147–1153`: „Rückgängig", „Ausschneiden",
„Kopieren", „Einfügen", „Alles auswählen"). Sie werden nur nirgends an
`electron-context-menu` durchgereicht.

### Änderung

**a) Eigenes Menü im Verlauf und in der Dateivorschau**

Neue Komponente `packages/app/src/components/text-context-menu.tsx`, die
`MenuV2.Context` (`packages/ui/src/v2/components/menu-v2.tsx:204`) bzw. `ContextMenu`
(`packages/ui/src/components/context-menu.tsx`) je nach `settings.general.newLayoutDesigns()`
verwendet — dasselbe Muster wie `FileCommentMenu`/`FileCommentMenuV2` in
`file-tabs.tsx:35/67`.

Einträge, alle abhängig davon, ob eine Auswahl besteht:

| Eintrag | Aktion |
| --- | --- |
| kopieren | `platform.runDesktopMenuAction("edit.copy")`, im Web `navigator.clipboard.writeText(selection)` |
| alles auswählen | `runDesktopMenuAction("edit.selectAll")` bzw. `document.execCommand("selectAll")` |
| Pfad kopieren | nur über einem Dateilink (`code[data-file-link]`), Pfad in die Zwischenablage |
| Link kopieren | nur über `a.external-link` |

Die IPC-Aktionen existieren bereits vollständig:
`preload/index.ts:130` → `ipc.ts:294` → `desktop-menu-actions.ts` (`edit.copy`,
`edit.selectAll`, `edit.cut`, `edit.paste`, …). Im Renderer über `usePlatform()`,
`platform.runDesktopMenuAction` (`context/platform.tsx:118`).

Montagepunkte:

- Verlauf: als Trigger um den Nachrichtencontainer in
  `pages/session/timeline/message-timeline.tsx` (`[data-slot="session-turn-message-container"]`,
  Zeilen 1241 und 1261).
- Dateivorschau: um `.mqorva-markdown-file-view` in `file-tabs.tsx:455`/`:745`.

Kobalte ruft am Trigger `preventDefault()` auf dem DOM-`contextmenu`-Event auf. Chromium
meldet dann gar kein `context-menu`-Event an den Main-Prozess, das native Menü bleibt in
diesen Bereichen automatisch weg — es ist keine zusätzliche Unterdrückung nötig.

**b) Natives Menü außerhalb: deutsche Labels**

In Eingabefeldern (Prompt, Suchfelder) bleibt das native Menü — dort braucht es
Rechtschreibvorschläge und ein zuverlässiges Einfügen. Es bekommt Labels aus `nativeT`:

```ts
contextMenu({
  showSaveImageAs: true,
  showLookUpSelection: false,
  showSearchWithGoogle: false,
  labels: {
    cut: nativeT("desktop.menu.cut"),
    copy: nativeT("desktop.menu.copy"),
    paste: nativeT("desktop.menu.paste"),
    selectAll: nativeT("desktop.menu.selectAll"),
    copyLink: nativeT("desktop.contextMenu.copyLink"),
    copyImage: nativeT("desktop.contextMenu.copyImage"),
    saveImageAs: nativeT("desktop.contextMenu.saveImageAs"),
    inspect: nativeT("desktop.contextMenu.inspect"),
  },
})
```

Zwei Punkte, die dabei zu beachten sind:

1. `contextMenu()` wird heute **einmal beim Start** aufgerufen (`index.ts:114`), also
   bevor der Renderer seine Sprache über `set-native-translations` (`ipc.ts:105`)
   meldet. `electron-context-menu` liest `options.labels[id]` allerdings bei **jedem**
   Rechtsklick neu (`index.js:323`). Es genügt daher, `labels` als Objekt mit Gettern
   zu übergeben, die `nativeT` erst beim Zugriff aufrufen — kein Neuregistrieren nötig.
2. Vier Schlüssel fehlen noch: `desktop.contextMenu.copyLink`, `.copyImage`,
   `.saveImageAs`, `.inspect`. Sie kommen nach `i18n/desktop-native.ts`
   (`DESKTOP_NATIVE_ENGLISH`) sowie nach `i18n/en.ts` und `i18n/de.ts`.

### Hinweis zum i18n-Paritätstest

`packages/app/src/i18n/parity.test.ts` schlägt **bereits heute** fehl: 60 der 61
Nicht-Englisch-Locales fehlen je 59 Schlüssel (u. a. `sidebarLayout.*`,
`session.file.markdownPreview`). Nur `de` ist vollständig. Neue Schlüssel nur in
`en` + `de` zu pflegen verschlechtert diesen Stand nicht, behebt ihn aber auch nicht.
Der bestehende Rückstand gehört separat aufgearbeitet und ist nicht Teil dieses Plans.

### Betroffene Dateien

- `packages/app/src/components/text-context-menu.tsx` (neu)
- `packages/app/src/pages/session/timeline/message-timeline.tsx`
- `packages/app/src/pages/session/file-tabs.tsx`
- `packages/desktop/src/main/index.ts`
- `packages/app/src/i18n/desktop-native.ts`, `i18n/en.ts`, `i18n/de.ts`

---

## Reihenfolge

1. Abschnitt 2 (eine CSS-Regel, sofort spürbar)
2. Abschnitt 1, Stufe A (Ladefeedback)
3. Abschnitt 1, Stufe C.7 (messen — bevor irgendetwas Größeres gebaut wird)
4. Abschnitt 3 (Kontextmenü, größter Anteil)
5. Abschnitt 1, Stufe B (fehlende Datei melden)
6. Abschnitt 1, Stufe C.8/C.9 nur, falls die Messung sie rechtfertigt

## Offene Risiken

- **Abschnitt 1, Stufe A:** Tabs für Pfade, die keine Datei sind, gehen weiterhin auf —
  künftig nur schneller. Behoben wird das erst mit Stufe B; bis dahin bleibt es beim
  heutigen Verhalten (leerer Tab).
- **Abschnitt 1, Stufe B:** Das zusätzliche Feld in `LegacyContent` ändert das
  öffentliche Protokoll. Nach AGENTS.md ist danach `bun run generate` in
  `packages/client` fällig, und es ist ein Kandidat für die Upstream-Prüfung
  (`plans/upstream-kandidaten.md`) — die Änderung ist produktneutral.
- **Abschnitt 1, Stufe B:** Das Zurückschließen des Vorschau-Tabs muss mit
  `tabs().preview` / `previewSessionTab` sauber zusammenspielen — Testfall in
  `context/layout-tabs.test.ts` sinnvoll.
- **Abschnitt 3:** Im eigenen Menü entfallen im Verlauf „Untersuchen" (DevTools) und
  Rechtschreibvorschläge. DevTools sind über das Ansicht-Menü und `F12` weiter
  erreichbar; Rechtschreibprüfung ist im Verlauf ohnehin bedeutungslos, da nicht
  editierbar.
- **Abschnitt 3:** `MenuV2.Context` ist bislang nirgends im Einsatz. Die Optik im
  v2-Design ist daher ungetestet und muss beim Umsetzen geprüft werden.
