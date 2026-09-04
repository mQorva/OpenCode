<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Logo OpenCode">
    </picture>
  </a>
</p>
<p align="center">L’agente di coding AI open source.</p>
<p align="center">
  <a href="https://opencode.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/opencode-ai"><img alt="npm" src="https://img.shields.io/npm/v/opencode-ai?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/opencode/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/opencode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

---

## mQorva Edition – la barra laterale

> Questo repository è un fork di [anomalyco/opencode](https://github.com/anomalyco/opencode). Non è sviluppato dal team di OpenCode e non è in alcun modo collegato a esso. Tutto ciò che segue questa sezione è il README originale.

![Barra laterale della mQorva Edition](docs/mqorva-sidebar.png)

La differenza visibile rispetto all'originale è la barra laterale a sinistra. Nell'originale le sessioni aperte sono schede nella barra del titolo; qui restano stabilmente in un elenco a sinistra, raggruppate per progetto.

**Cosa fa di diverso la barra laterale**

- Le sessioni sono raggruppate per progetto. Sopra si trovano i blocchi «Pinned» e «Sessions»; quest'ultimo raccoglie tutte le voci che non appartengono a nessun progetto aperto.
- Il trascinamento assegna: rilasciare una sessione su un progetto la assegna, rilasciarla in «Pinned» la fissa, spostarla all'interno di un blocco la riordina.
- La ricerca copre tutti i blocchi, nasconde i gruppi vuoti e segnala l'assenza di risultati.
- Il tasto destro apre i menu contestuali di progetto e sessione; non ci sono pulsanti a tre punti.
- Colore e icona definiti nelle impostazioni del progetto compaiono nell'elenco.
- La larghezza è regolabile e viene salvata. L'interruttore resta raggiungibile nella barra del titolo, anche senza progetti aperti.
- Una nuova sessione parte senza progetto assegnato. Il progetto lo determina solo l'elenco: il composer non mostra un secondo selettore di progetto.

**Passare da un layout all'altro**: Settings → General → «Sidebar layout». Disattivandolo torna il layout a schede dell'originale.

Server, sessioni, progetti, file, terminale e impostazioni restano funzioni OpenCode invariate; la barra laterale le presenta soltanto in modo diverso. Le altre differenze di questa edizione — ID applicazione proprio, directory dati separate, schema di versione proprio — sono documentate in [MQORVA.md](MQORVA.md), l'elenco delle modifiche in [CHANGELOG.mqorva.md](CHANGELOG.mqorva.md).

---

[![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

### Installazione

```bash
# YOLO
curl -fsSL https://opencode.ai/install | bash

# Package manager
npm i -g opencode-ai@latest        # oppure bun/pnpm/yarn
scoop install opencode             # Windows
choco install opencode             # Windows
brew install anomalyco/tap/opencode # macOS e Linux (consigliato, sempre aggiornato)
brew install opencode              # macOS e Linux (formula brew ufficiale, aggiornata meno spesso)
sudo pacman -S opencode            # Arch Linux (Stable)
paru -S opencode-bin               # Arch Linux (Latest from AUR)
mise use -g opencode               # Qualsiasi OS
nix run nixpkgs#opencode           # oppure github:anomalyco/opencode per l’ultima branch di sviluppo
```

> [!TIP]
> Rimuovi le versioni precedenti alla 0.1.x prima di installare.

### App Desktop (BETA)

OpenCode è disponibile anche come applicazione desktop. Puoi scaricarla direttamente dalla [pagina delle release](https://github.com/anomalyco/opencode/releases) oppure da [opencode.ai/download](https://opencode.ai/download).

| Piattaforma           | Download                           |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `opencode-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `opencode-desktop-mac-x64.dmg`     |
| Windows               | `opencode-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm`, oppure AppImage    |

```bash
# macOS (Homebrew)
brew install --cask opencode-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/opencode-desktop
```

#### Directory di installazione

Lo script di installazione rispetta il seguente ordine di priorità per il percorso di installazione:

1. `$OPENCODE_INSTALL_DIR` – Directory di installazione personalizzata
2. `$XDG_BIN_DIR` – Percorso conforme alla XDG Base Directory Specification
3. `$HOME/bin` – Directory binaria standard dell’utente (se esiste o può essere creata)
4. `$HOME/.opencode/bin` – Fallback predefinito

```bash
# Esempi
OPENCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://opencode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://opencode.ai/install | bash
```

### Agenti

OpenCode include due agenti integrati tra cui puoi passare usando il tasto `Tab`.

- **build** – Predefinito, agente con accesso completo per il lavoro di sviluppo
- **plan** – Agente in sola lettura per analisi ed esplorazione del codice
  - Nega le modifiche ai file per impostazione predefinita
  - Chiede il permesso prima di eseguire comandi bash
  - Ideale per esplorare codebase sconosciute o pianificare modifiche

È inoltre incluso un sotto-agente **general** per ricerche complesse e attività multi-step.
Viene utilizzato internamente e può essere invocato usando `@general` nei messaggi.

Scopri di più sugli [agenti](https://opencode.ai/docs/agents).

### Documentazione

Per maggiori informazioni su come configurare OpenCode, [**consulta la nostra documentazione**](https://opencode.ai/docs).

### Contribuire

Se sei interessato a contribuire a OpenCode, leggi la nostra [guida alla contribuzione](./CONTRIBUTING.md) prima di inviare una pull request.

### Costruire su OpenCode

Se stai lavorando a un progetto correlato a OpenCode e che utilizza “opencode” come parte del nome (ad esempio “opencode-dashboard” o “opencode-mobile”), aggiungi una nota nel tuo README per chiarire che non è sviluppato dal team OpenCode e che non è affiliato in alcun modo con noi.

---

**Unisciti alla nostra community** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
