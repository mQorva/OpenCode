# Seitenleisten-Layout — Feinschliff

Stand: 2026-08-26 · Branch: `dev` · schließt an [seitenleisten-layout.md](seitenleisten-layout.md) an (Phase 5)

Die Struktur steht und trägt: Umschalter, gruppierte Liste, Blöcke „Chats" / „Angeheftet" / „Projekte",
Entwürfe per Ziehen zuordnen, Kopfzeile über dem Chat, Panel-Schalter rechts. Dieser Plan sammelt nur, was den
vorhandenen Aufbau schärft — kein Umbau, keine fremde Vorlage als Sollzustand.

Grundlage ist eine Durchsicht des Codes, **nicht** eine Abnahme am laufenden Fenster. Wo die Wirkung erst dort
entschieden werden kann, steht es dabei.

---

## Erledigt

Stand 26.08.2026: alle Punkte dieses Plans sind umgesetzt, **keiner davon am laufenden Fenster abgenommen**.
Offen bleibt die optische Abnahme in hell und dunkel, bei schmaler und breiter Leiste, sowie ein Praxistest des
Ziehens.

- **Zeile entrümpelt** (1), **aktive Zeile ohne Balken** (2), **Verlauf am oberen Listenrand** (3),
  **Führungslinie** (4), **Hierarchie der Projektzeile** (5), **eigene Scrollfläche** (6), **Ziehgriff** (7),
  **Umsortieren per Ziehen** (8), **Umschalter in der Titelleiste** (F1), **Suche** (F2).
- **Projektfarbe und -symbol in der Leiste.** Beides ist im Projektdialog pflegbar und war nirgends in diesem
  Layout sichtbar — die Projektübersicht, die es sonst anzeigt, entfällt hier. Das Ordnersymbol trägt jetzt die
  gesetzte Farbe, ein eigenes Symbol ersetzt den Ordner. Ohne gesetzte Farbe bleibt es grau.
- Dauerhafter Scrollbalken im Chatverlauf, Schnellliste der Nutzereingaben, abgesetzte Composer-Fläche,
  Titelleistenfarbe unter den Fensterknöpfen (r1).

---

## 1 · Zeile entrümpeln

Der stärkste verbleibende Hebel. Die Sitzungszeile trägt heute rechts drei Dinge, die sich denselben Platz teilen
und einander verdrängen — relatives Alter, Ungelesen-Punkt, Spinner — und beim Zeigen zusätzlich drei Symbole
(⋯, Nadel, Archiv). Bei angehefteten Einträgen stehen die Symbole **dauerhaft**, kürzen den Titel und machen die
Liste unruhig.

- Alter beim Zeigen ausblenden, Symbole einblenden — so weit ist es schon; das Problem ist die Ausnahme für
  angeheftete Zeilen. Die Nadel darf als stiller Zustandsmarker bleiben, ⋯ und Archiv nicht.
- Der Spinner der laufenden Sitzung wird beim Zeigen mit ausgeblendet. Er muss stehen bleiben: sonst weiß man
  ausgerechnet beim Zielen nicht mehr, welche Sitzung arbeitet.
- Zu prüfen am Fenster: ob der Zähler an der Projektzeile bleibt. Er ist die vierte Zahl in einer Leiste, die sonst
  ohne Zahlen auskommt.

Dateien: `layout-sidebar/session-item.tsx`, `layout-sidebar/sidebar.tsx`

## 2 · Aktive Zeile sauber zeichnen

Der aktive Eintrag bekommt Fläche mit Rundung **und** einen 2 px breiten Balken bei `left-0`, der außerhalb der
Rundung sitzt und die Ecke anschneidet. Zeichenfehler, keine Geschmacksfrage.

Vorschlag: Balken weg, die Fläche trägt allein — sie ist deutlich genug. Gleiches Muster für Entwurf, Sitzung und
Projekt (alle drei haben denselben Balken).

Dateien: `layout-sidebar/session-item.tsx`, `layout-sidebar/sidebar.tsx`

## 3 · Verlauf am oberen Listenrand

Beim Scrollen läuft der oberste Eintrag hart unter die Kopfzeile. Ein weicher Verlauf über den ersten Pixeln der
Liste, sichtbar nur wenn nach oben gescrollt werden kann — dieselbe Machart wie unter dem Sitzungstitel im
Chatverlauf. Unten grenzt bereits die Trennlinie des Fußes ab, dort ist nichts nötig.

Dateien: `layout-sidebar/sidebar.tsx` (+ kleine CSS-Datei)

## 4 · Zugehörigkeit sichtbar machen

Sitzungen hängen per `pl-8` unter ihrem Projekt, ohne dass etwas die Gruppe zusammenhält. Eine dünne senkrechte
Linie in der Einrückung, vom ersten bis zum letzten Eintrag der Gruppe, macht aus der Liste mit Einzügen einen
lesbaren Baum. Dezent (`border-weaker`), nicht durchgehend über Blockgrenzen.

Dateien: `layout-sidebar/sidebar.tsx`

## 5 · Hierarchie zwischen Projekt- und Sitzungszeile

Beide sind 32 px hoch und nahezu gleich stark gesetzt (`text-13-medium` gegen `text-13-regular`). Die Gruppierung
trägt damit allein der Einzug. Vorschlag: Projektzeile etwas höher und kräftiger, Sitzungszeilen bleiben wie sie
sind. Am Fenster zu entscheiden — zu viel Unterschied zerlegt die Liste in Blöcke.

Dateien: `layout-sidebar/sidebar.tsx`

## 6 · Zwei Scrollleisten-Stile

Die Sitzungsliste nutzt `overflow-y-auto` (Systemleiste), der Chatverlauf die `ScrollView` mit eigenem Griff —
beide gleichzeitig sichtbar. Liste auf `ScrollView` umstellen, `thumbVisibility="always"`, `thumbInset={0}`.

Dateien: `layout-sidebar/sidebar.tsx`

## 7 · Ziehgriff

Die Breite ist ziehbar, die Kante gibt keine Rückmeldung. Beim Zeigen eine schmale Akzentlinie, Zeiger
`col-resize`.

Dateien: `layout-sidebar/sidebar.tsx` bzw. gemeinsamer `ResizeHandle`

## 8 · Chats per Ziehen ordnen

Reihenfolge innerhalb eines Blocks: eine gemerkte Sortierung je Projektgruppe und je Block, wie beim Anheften.
Ziehen in den Block „Angeheftet" heftet an, Herausziehen löst. Entwürfe bleiben wie bisher frei zwischen Projekten
ziehbar — sie haben noch kein Arbeitsverzeichnis.

**Kein Projektwechsel für gestartete Chats.** Entschieden am 26.08.2026.

Begründung, damit die Frage nicht wiederkehrt: `session.update` nimmt in beiden Protokollversionen nur `title`,
`metadata`, `permission` und `time.archived` — das Verzeichnis einer Sitzung ist nicht änderbar. Der einzige Weg
wäre `session.fork` ins Zielverzeichnis plus Archivieren des Originals
([session.ts:697](../packages/opencode/src/session/session.ts) legt die Kopie mit dem Verzeichnis der Anfrage an).
Das erzeugt aber eine neue Sitzungs-ID, lässt alte Verweise ins Leere zeigen, nimmt den laufenden Zustand nicht mit
und hinterlässt ein Archiv-Original. Für eine Aufräumgeste zu viel Nebenwirkung.

Dateien: `layout-sidebar/sessions.ts`, `layout-sidebar/sidebar.tsx`

---

## Behebung (funktional, nicht optisch)

### F1 · Zugeklappte Leiste ohne offenes Projekt ist eine Sackgasse

Der Umschalter sitzt im Kopf der Leiste (verschwindet mit ihr) und in der Kopfzeile der Session. Auf der
Startroute ohne offenes Projekt wird keine Session-Kopfzeile gerendert — dann bleibt nur das Tastenkürzel. Der
Leertext verweist zusätzlich auf „links", wo nichts steht.

Maßnahme: Umschalter in die v2-Titelleiste aufnehmen, wenn `layoutMode === "sidebar"` und die Leiste zu ist.
Deckt jede Route ab.

Dateien: `components/titlebar.tsx`

### F2 · Suche filtert nur die Projekt-Sitzungen

`filtered()` greift ausschließlich auf `groups()`. Der Block „Chats" bleibt bei jeder Suche vollständig stehen,
leere Projektgruppen bleiben mit „Keine Sitzungen" in der Trefferliste, ein Zustand „keine Treffer" fehlt.
Zusätzlich: `autofocus` auf dem dynamisch eingefügten Feld setzt den Fokus nicht zuverlässig, `Escape` schließt
nicht, ein Knopf zum Leeren fehlt.

Dateien: `layout-sidebar/sidebar.tsx`, `i18n/en.ts`, `i18n/de.ts`

---

## Bewusst nicht aufgenommen

- **Zeitgruppierung im Block „Chats".** Dort stehen meist wenige projektlose Einträge — Überschriften über je
  einer Zeile. Erst sinnvoll, wenn der Block regelmäßig groß wird.
- **Dauerhaft sichtbares Suchfeld.** Kostet permanent Höhe für etwas, das bei überschaubarer Sitzungszahl selten
  gebraucht wird. Die Lupe bleibt; nur Fokus und Schließen gehören repariert (F2).
- **Version in der Fußzeile.** Ballast. Ein Hinweis bei gestörter Serververbindung wäre sinnvoll, aber als
  Meldung im Störfall, nicht als Dauerpunkt.
- **Leerzustände mit Symbol pro Projektgruppe.** „Keine Sitzungen" ist eine Randnotiz. Nur das leere Startbild
  lohnt Aufwand — und dort vor allem wegen F1.
- **Farbstufen dokumentieren.** Schreibarbeit, keine Verbesserung. Die einzige offene Frage — ob Leiste und
  Eingabefeld dieselbe Stufe tragen dürfen — ist am Fenster in Sekunden entschieden.

## Offen

- Neue i18n-Schlüssel werden derzeit nur in `en` und `de` gepflegt; der Paritätstest über die übrigen Sprachen
  läuft dadurch rot. Entscheidung steht aus.
