# Tote Sessions dürfen die App nicht sprengen

Stand: 2026-09-05. Entstanden aus einem realen Vorfall, nicht aus einer Idee.

## Vorfall

Eine Session wurde gelöscht. Beim nächsten Start blieb die App in einer Sackgasse:

```
Error: Session not found: ses_f8f682054ffeNOcm3ztOOIsH4P
status: 404
```

Der Ablauf, nachvollzogen:

1. `renderer/index.tsx:105` stellt beim Start die zuletzt aktive URL wieder her und prüft nur,
   ob sie mit `/` beginnt — nicht, ob das Ziel noch existiert.
2. Die Route zeigt auf die gelöschte Session, der Server antwortet mit 404.
3. `pages/session.tsx` legte einen `AppStartupOverlay` **außerhalb** der
   `SessionRouteErrorBoundary`. Da `startup()` auf das Verzeichnis der Session wartet und
   dieses nie kommt, blieb `ready` dauerhaft false — der Overlay (`fixed inset-0 z-[9999]`)
   überdeckte die Fehlerseite samt ihrem Ausweg-Button.
4. Ergebnis: Man konnte weder die Session schließen noch woanders hin navigieren. Der einzige
   Ausweg war, den Local Storage der App von außen zu leeren.

## Bereits geändert (Wirkung unvollständig)

- **`context/tabs.tsx:311`** — `removeSessions` verlangte `params.dir`, das es nur auf der
  alten Route `/:dir/session/:id` gibt. Die Seitenleiste navigiert nach
  `/server/:serverKey/session/:id`, dort ist `params.dir` leer; die Folge-Navigation wurde nie
  erreicht und die gelöschte Session blieb in der Adresszeile stehen. `tabHref` baut ohnehin
  nur aus Server und Session-ID, die Bedingung war überflüssig.
- **`pages/session.tsx:193`** — der Overlay liegt jetzt innerhalb der
  `SessionRouteErrorBoundary`. Per CDP verifiziert: `Overlay da: false`, die App blockiert
  nicht mehr.
- **`context/tabs.tsx`** — `removeSessions` setzt den `recent`-Verweis auch dann zurück, wenn
  die gelöschte Session keinen offenen Tab mehr hatte. Dieser Verweis wird separat persistiert
  und überlebte sein Tab, weshalb der nächste Start ihn wiederherstellte.

### Verworfener Versuch: `throw` durch Zustand ersetzen

`session-lineage.ts` warf `sessionNotFoundError`; das wurde testweise durch ein `missing()`
ersetzt, das Aufrufer selbst behandeln (`session.tsx` mit einer herausgelösten
`SessionNotFound`-Komponente, `app.tsx` mit einer Weiterleitung nach `/`). Zurückgenommen, aus
zwei Gründen:

1. **Ziel nicht erreicht.** Die App zeigte weiterhin die globale Fehlerseite. Es wirft also noch
   etwas anderes; der Netzwerk-Mitschnitt gibt genau einen fehlgeschlagenen Request her
   (`404 /session/<id>`), eine unbehandelte Exception erscheint im CDP-Log nicht.
2. **Regressionsrisiko.** `missing()` wurde auch bei `state === "settled"` ohne Cache-Eintrag
   wahr. Eine langsam ladende, existierende Session hätte kurz „nicht gefunden" angezeigt — eine
   falsche Aussage, wo vorher nur ein Fehler stand.

Der nächste Anlauf muss zuerst den unbekannten Werfer finden.

## Gelöst: die Ursache des Vollcrashs

`pages/layout-sidebar/sidebar-data.tsx:58` lud die Session der aktuellen Route über ein
`createResource` — **ohne Fehlerbehandlung**:

```ts
({ sessionID, sdk }) => sdk.api.session.get({ sessionID }).then(normalizeSessionInfo)
```

Diese Resource liegt **außerhalb** der `SessionRouteErrorBoundary`. Eine abgelehnte Promise
darin erreicht deshalb die globale Boundary in `app.tsx:460` und ersetzt das ganze Fenster
durch „Etwas ist schiefgelaufen" — für einen Chat, der lediglich gelöscht wurde.

`components/titlebar.tsx:221` macht denselben Aufruf und hatte das `.catch(() => {})` bereits;
der Seitenleiste fehlte es.

Ermittelt durch Instrumentierung des API-Proxys (`utils/server-compat.ts`) mit dem
Aufrufer-Stack. Die vorherigen Vermutungen — Error-Boundary-Platzierung, das `throw` im
Lineage-Memo, `last-active-url`, `handoff` — waren alle falsch: Der Lineage-Pfad fängt seinen
Fehler korrekt ab, und der Wurf im Memo trat gar nicht auf.

**Verifiziert per CDP**, mit `handoff` auf eine gelöschte Session gesetzt:

```
Overlay      : false
Fehlerseite  : false
Seitenleiste : true
Inhalt       : OpenCode | ... | Projekte | OpenCode | PR #46166 … | Git Upstream Author …
```

Die App startet normal, die Seitenleiste zeigt die verbliebenen Sessions.

### Zusätzlich abgesichert

Zwei Effekte lasen das Lineage-Memo, das bei nicht auflösbarer Session wirft. Solids
`ErrorBoundary` fängt nur Render-Fehler; aus einem Effekt heraus läuft ein Wurf an ihr vorbei
bis zur globalen Boundary. Beide Stellen sind jetzt mit `catchError` gekapselt:
`pages/session.tsx` (Tab-Registrierung) und `app.tsx` (Legacy-Redirect).

## Unterscheidung: gelöscht ist nicht fehlend

Eine **gelöschte** Session darf gar keinen Fehler erzeugen — sie ist fort, und mit ihr müssen
alle Verweise fort sein. Eine **fehlende** Session (Server nicht erreichbar, andere Datenbank,
in einem anderen Client gelöscht) ist etwas anderes: Dort ist ein sichtbarer Hinweis richtig.

Daraus folgen zwei getrennte Aufgaben:

1. Beim Löschen jeden aktiven Verweis mitlöschen — dann tritt der Fall gar nicht ein.
2. Für den Rest: Der Fehler darf die Oberfläche nicht sprengen.

Beides ist umgesetzt (siehe oben und unten).

## Umgesetzt: Verweise sterben mit der Session

`context/layout.tsx` hört jetzt auf `opencode:session-tabs-removed` und verwirft den
`handoff`, wenn er auf eine der gelöschten Sessions zeigt. Der Handoff trägt eine Session-ID
über einen Layoutwechsel, wird persistiert und überlebte das Löschen — jeder spätere Start
versuchte, eine Session wiederherzustellen, die es nicht mehr gab.

`pages/layout-sidebar/sidebar.tsx` feuert dieses Event beim Löschen jetzt ebenfalls; bisher
tat das nur der Timeline-Pfad, weshalb ein Löschen aus der Seitenleiste die übrigen
Verweishalter nicht erreichte.

**Verifiziert:** Handoff auf eine existierende Session gesetzt, Lösch-Event ausgelöst, App neu
geladen und der persistierte Zustand geprüft — `handoff` ist danach fort.

## Befund: der Verweis überlebt an sechs Stellen

Nach dem Löschen einer Session steht ihre ID weiterhin in:

```
drafts.sqlite
opencode.global.dat
opencode.window.<id>.dat            (u.a. tabs.recent)
opencode.workspace.C--Users-Ron.*.dat
opencode.workspace.D--Coding-Op.*.dat
Local Storage/leveldb               (last-active-url)
```

Jeder dieser Speicher kann die App beim Start dazu bringen, die Session erneut abzufragen.
Drei davon sind inzwischen behandelt (siehe unten), mindestens drei nicht.

**Daraus folgt die eigentliche Richtung:** Jeden Speicher beim Löschen einzeln zu bereinigen
ist der falsche Weg — man vergisst immer einen, und jeder neue persistierte Zustand bringt das
Problem zurück. Robust ist nur, dass ein 404 auf eine Session die Oberfläche nicht sprengt.
Dann ist gleichgültig, woher ein veralteter Verweis stammt.

## Gefunden: woher die Session beim Start kommt

Gesucht wurde jeder Setter einer Session-Route. Ergebnis: es gibt genau **einen**.

- `desktop/src/renderer/index.tsx:107` — `DesktopMemoryRouter` liest
  `opencode.desktop.window.<id>.last-active-url` aus dem Local Storage und setzt sie über
  `history.set`, geprüft wird nur, ob sie mit `/` beginnt.
- `context/layout.tsx` leitet `route()` allein aus `location.pathname` ab; es gibt keine zweite
  Quelle.
- `pages/layout.tsx:488` (`autoselecting` → `navigateToProject` → `lastProjectSession`) navigiert
  ebenfalls automatisch, gehört aber zum **alten** Tab-Layout und läuft im Sidebar-Layout nicht.
- `pages/layout-sidebar/shell.tsx` navigiert nur auf Tastendruck (`stepSession`, `stepProject`).
- `toggleHome` in `context/tabs.tsx:373` springt zum zuletzt gemerkten Tab zurück — nur per Klick
  in der Titelleiste.

Damit ist die Frage beantwortet: Die App startet mit der zuletzt angezeigten URL, ungeprüft. Ein
wiederholtes „Zurücksetzen" der Route war nie nötig; es gab nichts, was sie erneut gesetzt hätte.

## Umgesetzt: eine wiederhergestellte Route meldet nichts

`utils/initial-route.ts` merkt sich, ob seit dem Öffnen des Fensters überhaupt navigiert wurde —
ein Modul-Flag, monoton, nicht reaktiv. `context/layout.tsx` setzt es bei der ersten Änderung von
`location.pathname`.

`pages/session.tsx` unterscheidet damit im Fehler-Fallback zwei Fälle:

- **Beim Start wiederhergestellt** und die Session existiert nicht mehr: der Verweis wird entfernt
  und still auf `/` navigiert. Keine Meldung — die Session ist fort, das ist keine Nachricht.
- **Vom Nutzer geöffnet**: die vorhandene Seite „Diese Sitzung wurde nicht gefunden" mit
  „Verweis entfernen" bleibt.

Der Zweig läuft genau einmal: die eigene Navigation setzt das Flag.

## Umgesetzt: Markierung statt Leerstelle

`SidebarSession` trägt ein Feld `missing`. `sidebar-data.tsx` setzt es, sobald der Server auf die
Session der aktuellen Route mit „gibt es nicht" antwortet — nur bei einem eindeutigen 404, ein
ausgefallener Server markiert nichts. Der Eintrag wird den unzugeordneten Chats vorangestellt, weil
die Seitenleiste sonst gar nichts zu der Sitzung zeigt, die gerade auf dem Bildschirm steht.

`session-item.tsx` kennt damit einen dritten `attention`-Zustand neben `permission` und `question`:
rot (`text-icon-critical-base`) statt orange, Warnsymbol, Titel „nicht gefunden", der Tooltip
erklärt den Grund. Ein Löschen auf so einem Eintrag fragt den Server nicht mehr — es gibt dort
nichts zu löschen — sondern entfernt nur noch die Verweise.

## Umgesetzt: Start auf einer Sitzung statt auf einer leeren Seite

Das Tab-Layout tut das seit jeher über `lastProjectSession` (`pages/layout.tsx:488`); das
Sidebar-Layout hatte kein Gegenstück. `layout-sidebar/shell.tsx` hat jetzt eines — und braucht dafür
keinen eigenen Speicher, weil die Seitenleiste ohnehin nach Aktivität sortiert: ihr erster Eintrag
*ist* die zuletzt benutzte Sitzung.

Es greift nur beim Start und nur, wenn keine Sitzung in der Route steht — ein frisches Fenster,
oder eines, dessen wiederhergestellte Sitzung es nicht mehr gibt. Wer selbst zur Startseite geht,
bleibt dort.

Damit das zusammenspielt, unterscheidet `utils/initial-route.ts` zwei Arten von Navigation: die des
Nutzers und die der App. Das Verwerfen einer toten Route ist letztere und beendet die
Startbehandlung nicht — sonst hätte sie den Nutzer auf der leeren Startseite abgesetzt.

## Entfernt: das Overlay im Sessionbereich

`pages/session.tsx` hatte einen eigenen Fortschritts-Overlay, der auf das Verzeichnis der Sitzung
wartete. Er blieb bei einer nicht auflösbaren Sitzung dauerhaft stehen und war auch sonst
überflüssig: das fensterweite Overlay in `app.tsx` deckt den Start ab, ein Sitzungswechsel fällt
auf das Workspace-Skelett zurück. Ersatzlos gestrichen.

## Zielbild

Eine tote Session ist ein **normaler Zustand**, kein Absturz:

- Der betroffene Eintrag wird farblich markiert — orange oder rot, oder mit einem Icon.
- Der Rest der Oberfläche bleibt bedienbar; andere Sessions lassen sich öffnen.
- Im Hauptbereich ein knapper Hinweis mit der Möglichkeit, den Eintrag zu schließen.

### Anknüpfungspunkt

Die Seitenleiste hat das Muster bereits: `pages/layout-sidebar/session-item.tsx:59` führt

```ts
attention: Accessor<"permission" | "question" | undefined>
```

und rendert daraus eine farbige Markierung. Ein dritter Zustand — „fehlt" — fügt sich dort
ein, ohne ein neues Konzept zu erfinden. Für die Tab-Leiste
(`components/titlebar-tab-strip.tsx`) gibt es noch kein Gegenstück; dort wäre eines zu
ergänzen.

## Vorschlag

1. **Ursache klären:** Warum landet der Fehler in der globalen statt in der
   Session-Boundary? Erst danach entscheiden, ob die Boundary anders platziert wird oder ob
   der Fehler gar nicht mehr geworfen werden soll.
2. **Zustand statt Ausnahme:** Wenn eine Session nicht auflösbar ist, einen definierten
   „fehlt"-Zustand liefern, statt `sessionNotFoundError` zu werfen. Das `throw` ist heute
   Absicht (siehe Kommentar), also ist das eine bewusste Vertragsänderung und kein Bugfix.
3. **Darstellung:** `attention` in der Seitenleiste um „fehlt" erweitern, ein Gegenstück in
   der Tab-Leiste ergänzen, im Hauptbereich die vorhandene „nicht gefunden"-Seite nutzen.
4. **Startpfad absichern:** `getLastActiveUrl` sollte eine Session-Route nicht blind
   wiederherstellen. Entweder vorab prüfen, oder beim Scheitern still auf `/` zurückfallen —
   damit ein veralteter Wert nie wieder eine Sackgasse erzeugt, unabhängig von Punkt 2.

## Offene Fragen

- Soll ein toter Eintrag automatisch verschwinden oder markiert stehen bleiben, bis der
  Nutzer ihn schließt? Automatisches Entfernen ist bequemer, verschluckt aber die Information,
  dass da mal etwas war.
- Gilt dasselbe für ganze Projekte, deren Verzeichnis nicht mehr existiert? Dort dürfte
  derselbe Mechanismus greifen — geprüft ist das nicht.
- Upstream oder Fork? Der Startpfad (`renderer/index.tsx`) und die Session-Route stammen aus
  der Basis; das Verhalten ist dort genauso kaputt. Vor einer Fork-Lösung klären.
