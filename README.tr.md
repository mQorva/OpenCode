<p align="center">
  <a href="https://opencode.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo">
    </picture>
  </a>
</p>
<p align="center">Açık kaynaklı yapay zeka kodlama asistanı.</p>
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

## mQorva Edition – kenar paneli

> Bu depo, [anomalyco/opencode](https://github.com/anomalyco/opencode) projesinin bir fork'udur. OpenCode ekibi tarafından geliştirilmemektedir ve onlarla hiçbir bağlantısı yoktur. Bu bölümün altındaki her şey özgün README'dir.

![mQorva Edition kenar paneli](docs/mqorva-sidebar.png)

Özgün sürümden görünür fark, soldaki kenar panelidir. Özgün sürümde açık oturumlar başlık çubuğunda sekme olarak durur; burada ise sürekli olarak solda bir listede, projeye göre gruplanmış hâlde bulunur.

**Kenar paneli neyi farklı yapıyor**

- Oturumlar projeye göre gruplanır. Üstte «Pinned» ve «Sessions» blokları yer alır; ikincisi açık hiçbir projeye ait olmayan tüm kayıtları toplar.
- Sürükle bırak atama yapar: bir oturumu proje üzerine bırakmak onu o projeye bağlar, «Pinned» içine bırakmak sabitler, blok içinde taşımak sıralamayı değiştirir.
- Arama tüm blokları kapsar, boş grupları gizler ve sonuç bulunmadığında bunu bildirir.
- Sağ tıklama proje ve oturum bağlam menülerini açar; üç nokta düğmesi yoktur.
- Proje ayarlarındaki proje rengi ve simgesi listede görünür.
- Genişlik sürüklenebilir ve kaydedilir. Geçiş düğmesi, açık proje olmasa bile başlık çubuğunda erişilebilir kalır.
- Oturum satırlarında zaman bilgisi yoktur; uzun başlıklar imleç üzerine gelince bir kez kayar.
- Yeni oturum projesiz başlar. Projeyi yalnızca liste belirler — yazma alanında ikinci bir proje seçici yoktur.

**Değiştirme**: Settings → General → «Sidebar layout». Kapatıldığında özgün sürümün sekmeli düzeni geri gelir.

Sunucu, oturumlar, projeler, dosyalar, terminal ve ayarlar değiştirilmemiş OpenCode işlevleri olarak kalır; kenar paneli bunları yalnızca farklı sunar. Bu sürümün diğer farkları — kendi uygulama kimliği, ayrı veri dizinleri ve kendi sürüm şeması — [MQORVA.md](MQORVA.md) dosyasında, değişiklik listesi ise [CHANGELOG.mqorva.md](CHANGELOG.mqorva.md) dosyasında belgelenmiştir.


---

[![OpenCode Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://opencode.ai)

---

### Kurulum

```bash
# YOLO
curl -fsSL https://opencode.ai/install | bash

# Paket yöneticileri
npm i -g opencode-ai@latest        # veya bun/pnpm/yarn
scoop install opencode             # Windows
choco install opencode             # Windows
brew install anomalyco/tap/opencode # macOS ve Linux (önerilir, her zaman güncel)
brew install opencode              # macOS ve Linux (resmi brew formülü, daha az güncellenir)
sudo pacman -S opencode            # Arch Linux (Stable)
paru -S opencode-bin               # Arch Linux (Latest from AUR)
mise use -g opencode               # Tüm işletim sistemleri
nix run nixpkgs#opencode           # veya en güncel geliştirme dalı için github:anomalyco/opencode
```

> [!TIP]
> Kurulumdan önce 0.1.x'ten eski sürümleri kaldırın.

### Masaüstü Uygulaması (BETA)

OpenCode ayrıca masaüstü uygulaması olarak da mevcuttur. Doğrudan [sürüm sayfasından](https://github.com/anomalyco/opencode/releases) veya [opencode.ai/download](https://opencode.ai/download) adresinden indirebilirsiniz.

| Platform              | İndirme                            |
| --------------------- | ---------------------------------- |
| macOS (Apple Silicon) | `opencode-desktop-mac-arm64.dmg`   |
| macOS (Intel)         | `opencode-desktop-mac-x64.dmg`     |
| Windows               | `opencode-desktop-windows-x64.exe` |
| Linux                 | `.deb`, `.rpm` veya AppImage       |

```bash
# macOS (Homebrew)
brew install --cask opencode-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/opencode-desktop
```

#### Kurulum Dizini (Installation Directory)

Kurulum betiği (install script), kurulum yolu (installation path) için aşağıdaki öncelik sırasını takip eder:

1. `$OPENCODE_INSTALL_DIR` - Özel kurulum dizini
2. `$XDG_BIN_DIR` - XDG Base Directory Specification uyumlu yol
3. `$HOME/bin` - Standart kullanıcı binary dizini (varsa veya oluşturulabiliyorsa)
4. `$HOME/.opencode/bin` - Varsayılan yedek konum

```bash
# Örnekler
OPENCODE_INSTALL_DIR=/usr/local/bin curl -fsSL https://opencode.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://opencode.ai/install | bash
```

### Ajanlar

OpenCode, `Tab` tuşuyla aralarında geçiş yapabileceğiniz iki yerleşik (built-in) ajan içerir.

- **build** - Varsayılan, geliştirme çalışmaları için tam erişimli ajan
- **plan** - Analiz ve kod keşfi için salt okunur ajan
  - Varsayılan olarak dosya düzenlemelerini reddeder
  - Bash komutlarını çalıştırmadan önce izin ister
  - Tanımadığınız kod tabanlarını keşfetmek veya değişiklikleri planlamak için ideal

Ayrıca, karmaşık aramalar ve çok adımlı görevler için bir **genel** alt ajan bulunmaktadır.
Bu dahili olarak kullanılır ve mesajlarda `@general` ile çağrılabilir.

[Ajanlar](https://opencode.ai/docs/agents) hakkında daha fazla bilgi edinin.

### Dokümantasyon

OpenCode'u nasıl yapılandıracağınız hakkında daha fazla bilgi için [**dokümantasyonumuza göz atın**](https://opencode.ai/docs).

### Katkıda Bulunma

OpenCode'a katkıda bulunmak istiyorsanız, lütfen bir pull request göndermeden önce [katkıda bulunma dokümanlarımızı](./CONTRIBUTING.md) okuyun.

### OpenCode Üzerine Geliştirme

OpenCode ile ilgili bir proje üzerinde çalışıyorsanız ve projenizin adının bir parçası olarak "opencode" kullanıyorsanız (örneğin, "opencode-dashboard" veya "opencode-mobile"), lütfen README dosyanıza projenin OpenCode ekibi tarafından geliştirilmediğini ve bizimle hiçbir şekilde bağlantılı olmadığını belirten bir not ekleyin.

---

**Topluluğumuza katılın** [Discord](https://discord.gg/opencode) | [X.com](https://x.com/opencode)
