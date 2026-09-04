# Startzeit der Desktop-App

Stand: 2026-09-04. Alle Zahlen sind gemessen, nicht geschätzt.

## Ausgangslage

Der Startpfad: Electron startet, spawnt `opencode-cli.exe` als Sidecar, der Renderer verbindet
sich und setzt dann seine Bootstrap-Requests ab.

Gemessener Lauf vom 2026-09-04 (warm, ein Fenster):

| Marke | Zeit | ab Start |
| --- | --- | --- |
| `app starting` | 13:30:17,500 | — |
| erster Request | 13:30:18,924 | 1,4 s |
| `init count=26` (Skills) | 13:30:27,815 | 10,3 s |
| letzter `/provider` | 13:30:57,342 | **39,8 s** |

`init count=26` ist **nicht** das Ende des Starts, sondern liegt mitten in der
Provider-Welle. Frühere Messungen von 11,9 – 19,4 s haben dort aufgehört und die Startdauer
damit zu niedrig ausgewiesen. Bis der Sidecar ruhig ist, vergehen rund **40 Sekunden**.

## Messung: `/provider` dominiert

Gesamtzeit aller HTTP-Requests eines Starts, nach Endpunkt (Mitschnitt über
`OPENCODE_LOG_REQUESTS` in der `disposeMiddleware`):

```
101,1 s   16 x   /provider
  7,8 s    7 x   /api/reference
  2,7 s    3 x   /lsp
  1,7 s    6 x   /path
  1,6 s    3 x   /session/…
  1,2 s    4 x   /agent
```

Einzelaufrufe unter Konkurrenz: 28,2 s (m1member), 17,1 s (OpenCode), 15,6 s (Home),
danach wiederholt 6,6 s / 6,1 s / 4,1 s / 4,0 s / 3,0 s.

Isoliert gemessen, ein Server ohne weitere Last:

```
1. Aufruf   1650 ms   Antwort 5650 KB
2. Aufruf    735 ms   Antwort 5650 KB
3. Aufruf    574 ms   Antwort 5650 KB
4. Aufruf    585 ms   Antwort 5650 KB
```

Die Antwort ist **5,79 MB** groß — der vollständige Katalog aus 213 Providern mit
7523 Modellen. Verbunden sind davon genau **zwei** (`opencode`, `openrouter`).

Die Antworten sind über alle Verzeichnisse **byte-identisch** (gleicher Hash, gleiche Länge,
gleiche `connected`-Liste). Das Verzeichnis ändert bei dieser Konfiguration nichts.

### Woher die Zeit kommt

`ProviderHttpApi.list` in `handlers/provider.ts` cacht **nichts**. Bei jedem Aufruf laufen
die Transformationen über alle 213 Provider erneut:

```
fromModelsDevProvider    40 –  73 ms
toPublicInfo            178 – 423 ms     ← Hotspot
JSON.stringify           44 –  53 ms
```

Der `ScopedCache` in `InstanceState` deckt nur `provider.list()` ab, also die verbundenen
Provider — nicht den Katalog. Die Serialisierung ist entgegen der ersten Vermutung **nicht**
das Problem; `toPublicInfo` ist es.

`toPublicInfo` (`provider.ts:1117`) macht zwei Dinge, aufgeschlüsselt gemessen:

```
Schema.is je Modell   143 ms   (7566 Modelle, alle gültig)
JSON-Roundtrip         37 ms   (Deepclone über JSON.parse(JSON.stringify(...)))
gesamt                178 ms
```

Die Validierung ist der Hauptanteil und ist wirkungslos: Die Daten stammen aus dem eigenen
Katalog, **alle 7566 Modelle bestehen den Check**. Über 27 Aufrufe je Start sind das rund
4 Sekunden reine Validierung ohne Ergebnis.

### `/api/reference` ist Folge, nicht Ursache

Mit 7,8 s über 7 Aufrufe der zweitgrößte Posten — aber isoliert gemessen, ohne parallele
Last, antwortet der Endpunkt in **387 ms**. Die 3–4 s je Aufruf entstehen, weil er zeitlich
mit der Provider-Serialisierung kollidiert und auf dem Event-Loop wartet. Fällt Maßnahme 1
und 2, erledigt sich das mit.

Über einen Start werden so ~150 MB JSON erzeugt, übertragen und im Renderer geparst.

## Messung: drei Instanzen statt einer

Der Sidecar bootet beim Start drei vollständige Instanzen, jede mit File-Watcher,
`project copy refresh` und eigenem Layer-Graph:

| Instanz | Herkunft |
| --- | --- |
| `C:\Users\Ronny` | Fallback `process.cwd()` in `packages/server/src/location.ts:34` für Requests **ohne** `x-opencode-directory` |
| `D:\Coding\OpenCode` | aktives Fenster |
| `D:\Coding\mQorva\m1member` | zweites Projekt der Liste, nicht geöffnet |

Belege:

- Ein Sidecar, 25 s ohne jeden Request, erzeugt **null** Instanzen. Alle drei kommen vom Renderer.
- `GET /config` ohne `directory`-Header erzeugt nachweislich die Home-Instanz.
- Im Mitschnitt gehen `/global/config`, `/provider`, `/path`, `/session/status` und `/project`
  ohne `directory` raus; für jedes Projekt der Liste folgt derselbe Satz aus `lsp`, `path`,
  `provider`, `reference`, `session` — parallel, unabhängig vom geöffneten Fenster.

`C:\Users\Ronny` ist **kein Projekt**. Der `global`-Eintrag in der Datenbank hat
`worktree: "/"` und dient als Bucket für projektlose Chats; solche Sessions existieren
derzeit keine. Die Home-Instanz entsteht allein durch den cwd-Fallback.

## Stand der Umsetzung

| Maßnahme | Status |
| --- | --- |
| 3 `staleTime` | umgesetzt |
| 2 Katalog-Cache | umgesetzt — isoliert 562 ms → 451 ms je Folgeaufruf |
| 5 Home-Instanz | **gestrichen** — Instanzaufbau kostet nur ~250 ms, siehe unten |
| 1 Payload, Server | umgesetzt — `?connected=true` liefert **288 KB in 58 ms** statt 5,79 MB in ~450 ms |
| 1 Payload, Client | umgesetzt, wirkt aber nur teilweise — siehe unten |
| Query-Key-Normalisierung | zusätzlich gefunden und behoben — siehe unten |
| 4 Projekte lazy | verworfen — kein belegter Gewinn |
| 6 Upstream-PR | offen |

### Zusätzlicher Fund: doppelte Cache-Einträge

Konsumenten erreichen die Bootstrap-Queries über `PathKey` (Backslashes zu Slashes
normalisiert), der Bootstrap übergab aber rohe Verzeichnisse. Dasselbe Verzeichnis lag damit
unter **zwei** Cache-Einträgen (`D:\Coding\OpenCode` und `D:/Coding/OpenCode`), und jeder
Konsument holte neu, was der Bootstrap bereits geladen hatte. `staleTime` konnte deshalb gar
nicht greifen. Die Query-Keys in `bootstrap.ts` normalisieren jetzt über `pathKey`.

### Ergebnis: übertragene Datenmenge

Der entscheidende Schritt war, die **schlanke Variante zum Default** von
`loadProvidersQuery` zu machen. Jeder Konsument teilt sich den Query-Key; einer, der vor dem
Bootstrap montiert, holt auf eigene Faust — mit `full` als Default zog dieser eine Konsument
den ganzen Katalog und machte die Ersparnis zunichte.

| | vorher | nachher |
| --- | --- | --- |
| `/provider`-Aufrufe je Start | 27 | 11 |
| davon voller Katalog | 27 | **1** |
| übertragen | ~156 MB | ~8,7 MB |

Die einzelne Antwort schrumpft von 5,79 MB auf 288 KB, der volle Katalog kommt genau einmal,
verzögert, für den globalen Eintrag.

### Belastbare Messung: gepackte App, vorher und nachher

Beide Läufe mit der installierten App, gleiche Marker:

| Marke | vorher (13:30) | nachher (22:45) |
| --- | --- | --- |
| `app starting` → `server ready` | 1,7 s | 1,7 s |
| → letzter `/provider` | **39,8 s** | **12,3 s** |
| `/provider`-Aufrufe | 27 | 11 |
| davon voller Katalog | 27 | **1** |
| Zeit in `/provider` | 101,1 s | 20,5 s |

Einschränkung: Zwischen beiden Läufen liegen auch der Versionssprung 1.18.27 → 1.18.28 und
das Schrumpfen der Datenbank von 1,85 GB auf 8 MB. Der Provider-Anteil ist davon unberührt.

### Was jetzt noch bremst: der Instanzaufbau

Die verbleibende Verzögerung liegt nicht mehr an der Payload. Zeitachse des Laufs von 22:45:

```
22:45:51.215     1ms  /provider schlank (global)
22:45:51.341     0ms  /provider schlank OpenCode
22:45:51.369     0ms  /provider schlank m1member
22:45:54.359  1785ms  /provider schlank OpenCode
22:45:54.803  2872ms  /lsp             m1member
22:45:57.492  2926ms  /api/reference   m1member
22:45:58.509  4136ms  /provider schlank m1member
```

Die frühen Antworten kommen in **unter 1 ms**. Langsam wird es ab 22:45:54 — und dann bei
*allen* Endpunkten, nicht nur `/provider`. In genau diesem Fenster laufen die drei
Instanz-Bootstraps (`creating instance` um 51,247 / 51,930 / 51,932).

Der längste Einzelaufruf, 7405 ms für eine schlanke Antwort, startete bei `+678 ms` — also
bevor die Fallback-Instanz stand. Er hat nicht gerechnet, er hat auf den Kontextaufbau
gewartet, während zwei weitere Instanzen denselben Thread belegten.

Der Hebel dafür ist der `useProviders`-Fund unten: Ein Anzeige-Hook bootstrappt Verzeichnisse
über `child()`.

### Wer die Instanz-Bootstraps auslöst

Gemessen mit derselben Methode wie bei den Providern — Instrumentierung an der **synchronen**
Stelle, hier `child()` in `child-store.ts`, statt am asynchronen Folgeschritt.

Ein Lauf, 22 Bootstrap-Anforderungen:

```
 2 x  C:\Users\Ronny
 8 x  D:\Coding\OpenCode
12 x  D:\Coding\mQorva\m1member     <- nicht geöffnet
```

Aufrufer laut Stack: `pages/layout-sidebar/sidebar-data.tsx` und `app.tsx`. Die maßgebliche
Stelle ist `sidebar-data.tsx:68`:

```ts
const groups = createMemo<SidebarProject[]>(() =>
  layout.projects.list().map((project) => {
    const sessions = directories.flatMap((directory) => {
      const [store] = serverSync().child(directory, { bootstrap: true })
      return sortedRootSessions(store, 0)...
```

Die Seitenleiste geht über **alle** Projekte und fordert für jedes explizit einen Bootstrap
an — `bootstrap: true` steht dort ausgeschrieben, es ist nicht der Default. Sie braucht davon
nur `sortedRootSessions(store, 0)`, also die Session-Liste für die Anzeige.

Ein zweiter Aufrufer steht direkt daneben (`sidebar-data.tsx:137`) und ein dritter in
`app.tsx:406`.

**Ansatzpunkt:** Der Kommentar bei `sidebar-data.tsx:108` erwähnt einen serverweiten
Session-Index (`globalSessions.sessions()`), der Sessions auch ohne Instanz kennt. Die
Seitenleiste könnte ihre Liste daraus speisen und den Bootstrap dem Projektwechsel überlassen.
Das ist ein Umbau der Datenquelle, kein Einzeiler.

**Gescheiterter Versuch:** `useProviders` auf `bootstrap: false` umzustellen, ergab
**33 Provider-Aufrufe statt 11** — vermutlich weil `provider_ready` dann nie wahr wird und der
reaktive Wert häufiger wechselt. Zurückgenommen. Der Bootstrap muss an der Quelle vermieden
werden, nicht bei einem Konsumenten abgeschaltet.

### Wer die Provider-Query auslöst

Ermittelt, indem die **Options-Erzeugung** instrumentiert wurde statt der `queryFn`: Die
Options entstehen synchron im Konsumenten, dort ist der Stack brauchbar; die `queryFn` ruft
TanStack asynchron auf und der Stack endet dort ins Leere. Vier Konsumenten:

| Stelle | Bezug |
| --- | --- |
| `server-sync.tsx:242` | `useQueries` mit `providers(null)` — der globale Eintrag, dauerhaft aktiv |
| `child-store.ts:196` | je Projekt-Verzeichnis |
| `session-composer-controls.ts:24-25` | `useProviders(() => sdk().directory)`, reaktiv am aktuellen Verzeichnis |
| `global.tsx` | Server-Kontext |

Nebenbefund mit eigenem Gewicht: `useProviders` (`hooks/use-providers.ts:19`) ruft
`serverSync().child(value)` auf — und `child()` bootstrappt das Verzeichnis, weil
`bootstrap: true` der Default ist. Ein Hook, der nur Provider **anzeigen** soll, löst damit
einen vollständigen Instanz-Bootstrap aus. Das erklärt, warum Instanzen auch für Projekte
entstehen, die man nur in der Seitenleiste sieht.

### Warum hier keine Zeitangaben stehen

Die dev-Läufe taugen für Aufrufzahlen — die entstehen im Client — aber **nicht für Dauern**.
Im letzten Lauf brauchten frühe *schlanke* Aufrufe 14 bis 29 Sekunden, während dieselben
Aufrufe später im selben Lauf 291 ms brauchten und isoliert 58 ms. Sie sind nicht langsam,
sie warten: Vite transpiliert im dev-Modus den Renderer, während der Server auf demselben
Thread arbeitet.

Belastbare Startzeiten brauchen einen Paketbau. Die isolierten Endpunktmessungen gegen einen
eigenen Sidecar (oben) sind davon unberührt.

## Maßnahmen

### 1. Provider-Antwort teilen, Rest im Hintergrund nachladen (größter Hebel)

Die Antwort besteht aus `all` (alle 213 Provider mit allen Modellen), `connected`
(IDs der verbundenen Provider), `default` und `defaultModel`.

Beim Start braucht die Oberfläche nur die verbundenen Provider und das Default-Modell —
für die Anzeige im Composer. Der vollständige Katalog wird ausschließlich von der
Modellauswahl gebraucht (`packages/app/src/pages/session/composer/prompt-model-selection.ts`
über `hooks/provider-catalog.ts`).

- Server: `/provider` bekommt einen Parameter, der die Antwort auf verbundene Provider
  beschränkt. **Additiv** — der bisherige Default bleibt der volle Katalog, damit TUI, SDK
  und andere Clients unverändert funktionieren.
- Client: Der Start-Bootstrap fordert die schlanke Variante an. Der vollständige Katalog
  wird danach im Hintergrund nachgeladen, damit die Modellauswahl beim Öffnen bereits
  gefüllt ist, ohne den Start zu blockieren.
- Betrifft `packages/opencode/src/provider/provider.ts`, die Route unter
  `packages/opencode/src/server/routes/instance/httpapi/` und
  `packages/app/src/context/global-sync/bootstrap.ts`.

Erwartung: Start-Antwort von 5,65 MB auf wenige hundert KB, Serialisierung von ~575 ms auf
zweistellige ms. Der volle Katalog kostet weiterhin ~575 ms, fällt aber aus dem Startpfad.

### 2. Katalogtransformation zwischenspeichern

`ProviderHttpApi.list` transformiert bei jedem Aufruf alle 213 Provider neu. Das Ergebnis
hängt nur an `models.json`, der Config und den Credentials — es kann zwischengespeichert und
an denselben Ereignissen invalidiert werden wie der `InstanceState`-Cache.

Da die Antwort über alle Verzeichnisse identisch ist, genügt ein prozessweiter Cache; er
muss nicht pro Instanz gehalten werden.

Erwartung: Folgeaufrufe von ~575 ms auf die reine Serialisierung (~50 ms). Billig und
serverseitig, ersetzt Maßnahme 1 aber nicht — Übertragung und Parsen im Renderer bleiben.

### 3. Aufrufzahl senken

In `packages/app/src/context/global-sync/bootstrap.ts` steht **keine einzige** `staleTime`
(0 Vorkommen). Der TanStack-Default ist 0, also gilt jeder Eintrag sofort als veraltet und
jeder `fetchQuery`/`createQuery` holt neu. Das betrifft nicht nur `/provider`, sondern
ebenso `/api/reference`, `/path`, `/lsp` und `/agent`.

Bei `/provider` multiplizieren vier Konsumenten das über drei Verzeichnisse auf 27 Aufrufe:

- `bootstrap.ts:158` — globaler Bootstrap (`directory: null`)
- `bootstrap.ts:529` — je Projekt in `bootstrapChild`
- `child-store.ts:196` — je Projekt-Verzeichnis
- `session-composer-controls.ts:33-34` — global und je aktuellem Verzeichnis, reaktiv über
  `createQuery`, also erneut bei jeder Neuauswertung

Maßnahmen:

- `staleTime` für die Bootstrap-Queries setzen. Andere Queries im Projekt nutzen dafür
  `Number.POSITIVE_INFINITY` (`server-sync.tsx:161`, `session.tsx:804`).
- Den Query-Key von `/provider` vom `directory` lösen. Gemessen sind die Antworten
  byte-identisch; vor der Umstellung prüfen, ob eine projektspezifische `cfg.provider` das
  ändern kann.

### 4. Projekte im Hintergrund nachladen

Beim Start nur das aktive Projekt vollständig laden. Die übrigen Projekte erscheinen in der
Liste, ihr Datensatz (`lsp`, `path`, `provider`, `reference`, `session`) wird erst beim
Aufklappen oder Wechseln geholt.

Damit entfällt eine komplette Instanz samt Watcher aus dem Startpfad, und die
Provider-Aufrufe reduzieren sich entsprechend.

Betrifft den Bootstrap in `packages/app/src/context/global-sync/` und `layout.tsx`.

### 5. Home-Instanz vermeiden — offen

**Wozu der Fallback existiert:** In `packages/protocol/src/api.ts` hängt fast jede API-Gruppe
an der `locationMiddleware` — Provider, Model, Agent, Command, Skill, Reference, FileSystem,
Credential, Integration. Nur Health und Events kommen ohne aus. Jeder dieser Requests braucht
deshalb ein Verzeichnis, auch wenn er fachlich keins hat: `/provider` liefert für alle
Verzeichnisse byte-identische Antworten, läuft aber trotzdem durch die Middleware. Der
Fallback auf `process.cwd()` in `location.ts:34` ist ein technischer Platzhalter.

**Verworfene Zwischenlösung:** Den Sidecar mit einem anderen Arbeitsverzeichnis zu starten
löst nichts — die Instanz samt Watcher wird weiterhin gebaut, sie zeigt nur woanders hin.
`userData` wäre sogar schlechter als das Home-Verzeichnis, weil dort Electrons Caches und die
Datenbank des Servers liegen und der Watcher auf die eigenen Schreibvorgänge der App
reagieren würde. Ein eigens angelegter leerer Ordner umgeht das, ist aber ein Workaround für
einen Workaround und hinterlässt unbegründeten Zustand auf der Platte. Beides zurückgenommen.

**Was tatsächlich nötig wäre**, eine der beiden Richtungen:

- Ein leichter globaler Kontext für Requests ohne `directory`, statt einen vollen
  `InstanceContext` aufzubauen. Betrifft die Middleware-Architektur in `protocol/src/api.ts`
  und `server/src/location.ts` und damit alle Clients.
- Oder enger gefasst: Der File-Watcher startet nur für Verzeichnisse, die tatsächlich ein
  Projekt sind. `packages/core/src/filesystem/watcher.ts` startet ihn heute bedingungslos für
  jede Location; eine Bedingung dort wäre der deutlich kleinere Eingriff und würde die
  Fallback-Instanz still stellen, ohne den Kontextaufbau anzufassen.

## Fallback-Instanz: gemessen, nicht lohnend

Isoliert gemessen, erster Request baut die Instanz, Folgeaufrufe treffen sie:

```
/path ohne directory (Fallback-Instanz)      258 ms → 11 ms → 6 ms
/path mit directory (echtes Projekt)         503 ms → 56 ms
```

Der Aufbau der Fallback-Instanz kostet **rund 250 ms einmalig**. Gemessen an einer Startzeit
von ~40 s sind das unter 1 %. **Maßnahme 5 und der Umbau auf einen lazy aufgebauten Kontext
lohnen sich als Startzeit-Maßnahme nicht** und sind hier gestrichen.

Damit ist der gesamte Fallback-Komplex — Home-Verzeichnis, cwd, Instanzaufbau — für die
Startzeit erledigt. Der Hebel liegt allein bei `/provider`.

Die fachliche Frage, ob Sessions überhaupt projektlos sein dürfen und wie ein späterer
Projektwechsel aussieht, ist davon unabhängig und in `plans/session-projektwechsel.md`
ausgelagert.

## Reihenfolge

1. Maßnahme 3 (`staleTime`) — kleinster Eingriff, nimmt den Großteil der 27 Aufrufe weg.
2. Maßnahme 2 (Katalog-Cache) — serverseitig, keine Client-Änderung nötig.
3. Maßnahme 5 (Home-Instanz) — zunächst als cwd-Änderung.
4. Maßnahme 4 (Projekte lazy) — größerer Eingriff in den Renderer-Bootstrap.
5. Maßnahme 1 (Payload teilen) — größter Nutzen, betrifft den API-Vertrag.
6. Maßnahme 6 (Upstream-PR) — erst nach 1 bis 5.

Nach jedem Schritt neu messen: Startdauer bis zum letzten `/provider`, Anzahl und Dauer der
Requests im Mitschnitt.

## Fork oder Upstream?

Alle Ursachen liegen in der OpenCode-Basis, keine ist mQorva-spezifisch. `git blame` auf die
betroffenen Zeilen:

| Stelle | Urheber |
| --- | --- |
| `toPublicInfo` mit `Schema.is` + Deepclone | Aiden Cline, Kit Langton (Upstream) |
| `ProviderHttpApi.list` ohne Cache | Kit Langton, OpeOginni (Upstream) |
| `loadProvidersQuery` ohne `staleTime` | Brendan Allan (Upstream) |
| cwd-Fallback in `location.ts` | Dax, James Long, Kit Langton (Upstream) |
| `cwd: process.cwd()` im Sidecar-Spawn | Brendan Allan (Upstream) |

Die Fork-Commits in `desktop/src/main/server.ts` und `global-sync/bootstrap.ts` betreffen
umliegende Zeilen, nicht die Ursachen selbst. Alle Maßnahmen sind damit
upstream-tauglich — siehe den `upstream-pr`-Skill für die Einreichung.
- ~~Die Lücke zwischen dem letzten `booting location services` und `init count=26`~~ —
  geklärt: keine eigene Phase. Der Event-Loop ist in dieser Zeit mit der Serialisierung der
  `/provider`-Antworten belegt, weshalb der Skill-Init erst verzögert drankommt. Die
  Provider-Welle läuft nach `init count=26` noch rund 30 Sekunden weiter (27 Aufrufe,
  letzter um 13:30:57). Die Skill-Scans selbst kosten 2–395 ms je Glob.

## Diagnose-Werkzeug

Das Request-Logging hinter `OPENCODE_LOG_REQUESTS=1` liegt in:

- `packages/opencode/src/server/routes/instance/httpapi/lifecycle.ts` — `REQ`-Zeilen mit
  Startversatz, Dauer, Methode, URL und `directory`
- `packages/opencode/src/skill/index.ts` — `SKILLSCAN`-Zeilen je Glob
- `packages/server/src/location.ts` — aufgelöstes `directory` je Request

Die Ausgabe landet über den Sidecar-stderr in `logs/<lauf>/server.log` der Desktop-App.
Vor einem Upstream-PR entfernen.
