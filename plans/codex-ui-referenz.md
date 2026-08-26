# Codex-UI — Referenzaufnahme und Ableitungen

Aufgenommen am 2026-08-26 aus **OpenAI Codex 26.818.8289.0** (Windows, Electron/Chromium 151).

**Rohmaterial liegt bewusst außerhalb des Repos** unter `D:/Coding/_ref/codex-ui/`:

- `css/` — 191 extrahierte Stylesheets (~1,05 MB) aus `resources/app.asar`
- `shots/` — Fensteraufnahmen
- `extract.mjs` — Extraktionsskript (`node extract.mjs`)
- `shot.ps1` — Fensteraufnahme ohne Fokuswechsel (`-Count`, `-DelayMs`, `-Prefix`)

Dieses Dokument hält nur die *Beobachtungen* fest — Maße, Kurven, Mechanik. Fremder Code wird
nicht ins Repo übernommen; alles hier Abgeleitete wird selbst geschrieben.

## Aufnahmeverfahren

Codex' Oberfläche ist eine Chromium-Webview. Das komplette Stylesheet liegt minifiziert, aber
vollständig im `app.asar`. Das ist der ergiebigere Weg als Screenshots: Zustände, die man nur
durch Bedienen sieht (Hover, Scrub, Fokus, reduced-motion), stehen dort explizit drin.

Die Fensteraufnahme per `PrintWindow` funktioniert, holt Codex aber nicht in den Vordergrund.
Einschränkung: Chromium rendert GPU-beschleunigt, deshalb liefert eine schnelle Bildserie
denselben Frame — **bewegte Abläufe lassen sich so nicht mitschneiden**. Für Bewegung ist das CSS
die Quelle, nicht das Bild.

Nicht ausgewertet: die JS-Bundles (das Archiv enthält 8628 Dateien, angesehen wurden nur die
191 CSS). Dort läge die Markup-Struktur — für Optik nicht nötig, für Interaktionslogik schon.

---

## 1 Farbsystem

Zwei Ebenen. Unten eine Rampe, darüber Rollen-Tokens (`--color-text`, `--color-surface`,
`--color-background-button-primary-hover` …). Themes tauschen nur die Rampe.

### Graustufen — 18 Stufen, exakt neutral

```
0    #ffffff      550  #4f4f4f
50   #f9f9f9      600  #414141
75   #f3f3f3      650  #393939
100  #ededed      700  #303030
150  #dfdfdf      750  #282828
200  #cdcdcd      800  #212121
300  #afafaf      900  #181818
400  #8f8f8f      950  #131313
500  #5d5d5d      1000 #0d0d0d
```

Kein Farbstich, R = G = B durchgängig. Auffällig ist die **Verdichtung im Dunklen**: zwischen
700 und 1000 liegen sechs Stufen mit 4–8 Punkten Abstand. Genau dort braucht ein Dunkelmodus die
Auflösung, um Ebenen zu trennen, ohne dass Kanten sichtbar werden. Im hellen Bereich sind die
Abstände viel gröber (0 → 50 → 75 → 100), weil dort ein Punkt Unterschied schon sichtbar ist.

Zum Vergleich: unser Dunkelmodus arbeitet an dieser Stelle mit `color-mix` zwischen zwei Tokens
(siehe [shell.css](../packages/app/src/pages/layout-sidebar/shell.css)) — funktioniert, ist aber
eine Rechnung statt einer Rampe, und deshalb nur an der einen Stelle verfügbar.

### Akzente — je 8–11 Stufen

Blau `#0285ff` (400) als Primärakzent, dazu Grün, Rot, Orange, Lila, Gelb. Jede Familie mit
25/50/75/100…950. Im Dunkelmodus wird nicht dieselbe Stufe verwendet, sondern eine hellere:
`--color-accent-green` ist hell `green-500`, dunkel `green-300`.

### Zwei Muster, die uns fehlen

**Zustände werden gemischt, nicht gesetzt.** `hover` / `active` / `inactive` entstehen aus
`color-mix(in oklab, …)` gegen die Vordergrundfarbe — typisch 2 % / 6 % / 10 % Deckung,
sekundär 4 % / 8 % / 12 %. Ein Theme-Wechsel trägt automatisch durch, ohne dass Zustandsfarben
nachgepflegt werden. `oklab` statt `srgb`: gleiche Zahl, gleiche wahrgenommene Helligkeitsstufe
über den ganzen Farbkreis.

**Abgeleitete Sekundärfarben.** `--color-codex-description` ist keine eigene Farbe, sondern 70 %
Textfarbe gegen Transparenz. Sekundärtext bleibt so in jedem Theme im Verhältnis.

### Ränder und Fokus

Randfarben sind ebenfalls gemischt: `--color-border-heavy` ist 16 % Weiß gegen Transparenz.
Der Fokusrand ist Blau-300 auf 70 % Deckung (`#339cffb3`) — kein Vollton, dadurch ein Ring, der
sichtbar ist, ohne die Fläche zu dominieren.

---

## 2 Maß und Struktur

### Spacing

Basiseinheit `--spacing: .25rem` (4 px), alles wird daraus errechnet. Keine freien Pixelwerte in
den Komponenten.

### Radien mit globalem Faktor

```
2xs  .125rem     lg   .625rem
sm   .375rem     2xl  1rem
md   .5rem       3xl  1.25rem
                 4xl  1.5rem
```

Bemerkenswert: jeder Radius ist `Basiswert × var(--corner-radius-scale)`. Die Rundung der ganzen
App ist damit **ein einziger Regler** — vermutlich eine Einstellung für den Nutzer. Der
`--radius-full: 9999px` bleibt außen vor.

### Zeilen

Nav- und Listenzeilen: **Höhe 30 px**, Padding X 8 px, Y 4–5 px, Radius 10 px. Die Höhe ist
nicht hart gesetzt, sondern `Textgröße × 1.5 + Padding` — sie wächst also mit der
Schriftgrößeneinstellung mit.

### Sidebar

Breite `clamp(240px, --codex-sidebar-preferred-width (Vorgabe 275px), …)` — ziehbar mit
Untergrenze. Fußbereich 72 px oder 0.

### Typografie

`--text-base: 14px`, Überschriften 16/18/20/24 px. Zeilenhöhen als Verhältnis, nicht als Pixel.
Es gibt eine App-weite Schriftgrößeneinstellung (`--codex-chat-font-size`), an die sich
Detailzeilen anhängen.

---

## 3 Elevation

```
elevation-stroke     0 0 0 .5px  Randfarbe
elevation-sidebar    stroke + 0 3px 7.5px #00000008 + 0 0 16px #00000005
elevation-prominent  stroke + 0 3px 7.5px #0000000a + 0 0 20px #0000000d
```

Die Schatten sind **extrem schwach** — 3 % und 2 % Deckung. Die Trennung leistet die
0,5-px-Kontur, der Schatten setzt nur einen Hauch Tiefe darunter. Dazu je ein enger und ein
weiter Schatten ohne Versatz.

Unsere `--v2-elevation-raised` nutzt dieselbe Idee inklusive 0,5-px-Kontur, im Dunkelmodus aber
mit 30 % Deckung in beiden Schattenlagen. Das ist eine Größenordnung kräftiger und der Grund,
warum unsere Flächen eher „aufgeklebt" wirken, wo Codex' Flächen nur leicht abheben.

---

## 4 Motion

Eine Kurve dominiert alles: **`cubic-bezier(.23, 1, .32, 1)`** — easeOutQuint, 21 Verwendungen
über alle Dateien. Sehr schneller Anlauf, langer weicher Auslauf. Codex' Handschrift.

| Kurve | Zweck |
| --- | --- |
| `cubic-bezier(.23, 1, .32, 1)` | Standard für alles Sichtbare |
| `cubic-bezier(.4, 0, .2, 1)` | Material-Standard, für Neutrales |
| `cubic-bezier(.2, .8, .2, 1)` | leichter Zug nach vorn |
| `cubic-bezier(.4, 0, 1, 1)` | Verschwinden (easeIn) |

Dazu fünf `linear()`-Kurven — abgetastete Federn, die eine Bezier nicht abbilden kann. Die
Markerleiste nutzt eine mit leichtem Überschwingen: bis 60 % auf 1.004, Spitze 1.008 bei 70 %,
dann Einschwingen auf 1. Kein sichtbares Wackeln, aber der Marker „kommt an" statt zu bremsen.

**Dauern:** 160 ms Marker, 280 ms Auftauchen, 2,4 s Ruhepuls.

**Reduced Motion zweifach** — `@media (prefers-reduced-motion: reduce)` *und* ein Attribut
`:root[data-reduced-motion="true"]`, damit die App eine eigene Einstellung anbieten kann. Jeder
animierte Baustein hat eine Abschaltregel. Bei uns fehlt das durchgehend.

---

## 5 Markerleiste am Thread

Codex nennt sie *floating navigation rail*. Steht funktional auf demselben Gedanken wie unsere
[message-rail.tsx](../packages/app/src/pages/session/timeline/message-rail.tsx), löst ihn aber an
mehreren Stellen anders.

**Maße:** Marker 26 px breit, 2 px hoch, Ruhe-Deckung 0,4.

**Wachstum per `transform: scaleX()`** mit `transform-origin: 0` — von 23,08 % auf 100 %, also
6 → 26 px. Wir animieren stattdessen `width`, was pro Bild ein Layout auslöst.

**Fisheye über Nachbarschaft.** Nicht nur der Marker unter dem Zeiger wächst, sondern die
Nachbarn gestaffelt: **100 % / 70 % / 40 % / 20 %**. Genau das macht eine dichte Leiste zielbar —
man sieht, wohin man steuert, bevor man dort ist. Rein in CSS über `:has(+ button:hover)`-Ketten,
ohne eine Zeile JavaScript.

**Der aktive Marker tritt zurück, sobald woanders gehovert wird** — er fällt auf Ruhefarbe und
0,4 zurück, solange der Zeiger in der Leiste ist. Dadurch konkurrieren „wo bin ich" und „wo zeige
ich hin" nicht miteinander. Kleines Detail, großer Anteil am fertigen Eindruck.

**Scrubbing.** Die Leiste lässt sich ziehen. Währenddessen Transition auf `0s` — der Marker klebt
am Finger statt hinterherzufedern. Das Ziel wird über ein Attribut markiert, die
Fisheye-Staffelung läuft dann von dort aus statt vom Zeiger.

**Bookmark-Punkt.** Ein Marker kann einen Punkt am Ende tragen, der mit der Wachstumskurve
mitwandert; ein solcher Marker steht dauerhaft auf Deckung 1 statt 0,4.

**Vorschau** als eigenes Markdown-Fragment gestylt, auf 3 Zeilen begrenzt — bei Tabellen über
`max-height`, nicht über Zeilenklammerung.

### Vergleich mit unserem Stand

| | Codex | OpenCode heute |
| --- | --- | --- |
| Wachstum | `scaleX`, GPU | `width`, Layout pro Bild |
| Staffelung | 100/70/40/20 über Nachbarn | Kosinus-Abfall, in JS je Marker berechnet |
| Kurve | Feder, 160 ms | `ease-out`, 90 ms |
| Zeigerverfolgung | reines CSS | Solid-Update bei jedem `pointermove` |
| Aktiv bei Hover | tritt zurück | bleibt hell |
| Ziehen | ja, ohne Nachfedern | nicht vorhanden |
| Reduced Motion | ja | nein |
| Marker-Zusatzzustand | Bookmark-Punkt | nur aktiv / nah |

Unser Kosinus-Abfall ist als Kurve feiner als Codex' vier Stufen. Der Nachteil liegt nicht in der
Form, sondern im Weg dorthin: Breite in JS ausrechnen und als Inline-Style auf jeden Marker
schreiben heißt, bei jeder Zeigerbewegung durch die ganze Liste zu laufen und Layout anzustoßen.

---

## 6 Animierte Objekte

**Auftauchen** (`chip-enter`): 280 ms, easeOutQuint, mit Überschwingen. Start bei Deckung 0,
8 px links / 4 px unten, Maßstab 0,92 → bei 70 % Deckung 1, 1 px rechts / 1 px hoch, Maßstab 1,02
→ Ende auf Ruhelage. Der Überschuss bei 70 % ist der Grund, warum es lebendig statt geschaltet
wirkt. `transform-origin: 0`, das Element wächst aus seiner linken Kante.

**Ruhepuls** für Platzhalter: Deckung 0,68 ↔ 0,82 über 2,4 s, `ease-in-out`. Sehr flach und sehr
langsam — es blinkt nicht, es atmet. Die Platzhalterfläche ist 8 % Textfarbe in der Oberfläche
gemischt (dunkel 12 %). Bei reduzierter Bewegung wird nicht nur die Animation abgeschaltet,
sondern die Deckung auf 0,76 gesetzt — die Mitte des Pulses, nicht ein Extremwert.

Unser Pendant ist Tailwinds `animate-pulse`: Deckung 1 ↔ 0,5 über 2 s. Viermal so großer Hub.

**Shimmer** in zwei Bauarten: als Hintergrundposition von −100 % auf 250 %, wobei die Bewegung
nach 40 % der Laufzeit fertig ist und der Rest Pause bleibt — ein Takt statt eines Dauerlaufs.
Und als verschobenes Element von −50 % auf 125 %.

**Scroll-Kanten als Maske, nicht als Overlay.** Die Sidebar blendet oben und unten über
`mask-image` aus, mit variablem Start und variabler Distanz (Fußbereich 40 px). Unser
[sidebar.css](../packages/app/src/pages/layout-sidebar/sidebar.css) legt stattdessen einen
Verlauf in Hintergrundfarbe darüber. Das funktioniert nur, solange dahinter genau diese Farbe
liegt — bei Auswahl-Highlights, Drop-Markern oder einem abweichenden Untergrund bricht es. Eine
Maske ist unabhängig davon.

**Marquee** — haben wir mit [marquee.css](../packages/app/src/pages/layout-sidebar/marquee.css)
selbst. Codex kombiniert den Lauf mit einer *animierten Maske*: die rechte Auslaufkante wird erst
bei 75 % der Laufzeit eingeblendet, indem `mask-size` wächst. Der Text verschwindet also nicht von
Anfang an in einer Kante, sondern erst wenn wirklich etwas überläuft.

**Fortschrittsring** über `stroke-dashoffset`. **Einblenden von Text** über die Farbe von
transparent auf Ruhefarbe, nicht über `opacity` — die Umgebung bleibt unangetastet.

**Blur** wird sparsam eingesetzt, in festen Stufen 4 / 8 / 12 / 16 / 20 / 40 px.

---

## 7 Vorschläge, priorisiert

Reihenfolge nach Verhältnis von Wirkung zu Aufwand.

### Markerleiste

1. **`width` → `transform: scaleX()`.** Behebt das Ruckeln bei langen Sessions, rein mechanisch,
   kein Designentscheid.
2. **Fisheye nach CSS verlagern.** Nachbar-Staffelung über `:has()`, Zeigerposition nur noch für
   die Vorschau in JS. Spart den Durchlauf pro Zeigerbewegung.
3. **Aktiven Marker beim Hovern zurücktreten lassen.** Drei Zeilen, deutlicher Effekt.
4. **Federkurve statt `ease-out`,** 160 ms statt 90.
5. **Ziehen zum Scrubben** mit ausgeschalteter Transition währenddessen.

### Farbe und Fläche

6. **Elevation abschwächen.** Unsere Schatten stehen im Dunkelmodus auf 30 %, Codex auf 2–3 %.
   Die 0,5-px-Kontur haben wir bereits — sie kann die Arbeit allein tragen.
7. **Zustandsfarben aus `color-mix(in oklab, …)`** statt fester Tokens, beginnend bei der Railbar
   links und den Sitzungszeilen.
8. **Dichtere Graustufen im Dunkeln.** Statt einer `color-mix`-Rechnung an einer Stelle eine
   Rampe mit ausreichend Stufen zwischen #303030 und #0d0d0d.

### Bewegung allgemein

9. **`prefers-reduced-motion` durchgehend** — Markerleiste, Marquee, Pulse, alles Bewegte.
   Fehlt momentan überall.
10. **Ruhepuls flacher.** 0,68 ↔ 0,82 statt Tailwinds 1 ↔ 0,5.
11. **Auftauch-Animation mit Überschwingen** für Elemente, die während eines Laufs erscheinen.
12. **Scroll-Kanten auf `mask-image` umstellen** statt Verlaufs-Overlay.
13. **Marquee-Maske erst spät einblenden** statt dauerhaft.

### Struktur

14. **Globaler Rundungsfaktor** — ein `--corner-radius-scale`, an dem alle Radien hängen.
15. **Zeilenhöhe aus Schriftgröße rechnen** statt fest setzen, damit eine
    Schriftgrößeneinstellung durchträgt.

---

## Offen

- Bewegte Abläufe konnten nicht mitgeschnitten werden (GPU-Rendering, siehe oben). Falls ein
  konkreter Ablauf strittig ist, wäre der Weg, Codex mit Remote-Debugging zu starten und die
  Animation dort zu inspizieren — dafür müsste die App neu gestartet werden.
- Die schmale Icon-Leiste links (`sidebar-rail`, 64 px) ist noch nicht gegen Codex verglichen.
- Die JS-Bundles sind nicht ausgewertet; Markup-Struktur und Interaktionslogik fehlen deshalb.
