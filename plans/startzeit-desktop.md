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
toPublicInfo            336 – 423 ms     ← Hotspot
JSON.stringify           44 –  53 ms
```

Der `ScopedCache` in `InstanceState` deckt nur `provider.list()` ab, also die verbundenen
Provider — nicht den Katalog. Die Serialisierung ist entgegen der ersten Vermutung **nicht**
das Problem; `toPublicInfo` ist es.

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

### 5. Home-Instanz vermeiden

Requests ohne `directory` sollen keinen vollwertigen Projektkontext mit File-Watcher über
dem Home-Verzeichnis aufbauen.

- Sauber: einen leichten globalen Kontext für diese Requests, statt `process.cwd()` als
  Projektverzeichnis zu behandeln (`packages/server/src/location.ts:34`).
- Billig als Zwischenschritt: den Sidecar mit einem unkritischen Arbeitsverzeichnis starten
  (z. B. `userData`), damit der Watcher nicht das Home-Verzeichnis scannt
  (`packages/desktop/src/main/server.ts`, `spawnLocalServer` setzt `cwd: process.cwd()`).

## Reihenfolge

1. Maßnahme 3 (`staleTime`) — kleinster Eingriff, nimmt sofort 13 von 16 Aufrufen weg.
2. Maßnahme 2 (Antwort-Cache) — serverseitig, keine Client-Änderung nötig.
3. Maßnahme 5 (Home-Instanz) — zunächst als cwd-Änderung.
4. Maßnahme 4 (Projekte lazy) — größerer Eingriff in den Renderer-Bootstrap.
5. Maßnahme 1 (Payload) — größter Nutzen, aber mit Abstimmungsbedarf über alle Clients.

## Offene Punkte

- `/api/reference` ist mit 7,8 s über 7 Aufrufe der zweitgrößte Posten. Die Ursache der
  fehlenden Zwischenspeicherung ist dieselbe (kein `staleTime`), der serverseitige Aufwand
  je Aufruf ist aber nicht aufgeschlüsselt.
- Warum `toPublicInfo` über 213 Provider 336–423 ms braucht, ist nicht im Detail
  untersucht — die Funktion wird beim Umsetzen von Maßnahme 2 ohnehin angefasst.
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
