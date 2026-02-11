# ⚡ Prism Reader

**A beautiful RSS/Atom/XML reader extension for Chrome and Edge.**

Prism Reader transforms raw XML feeds into an elegant, visual reading experience — complete with a dashboard, reading stats, keyword watchlist, and more.

<p align="center">
  <img src="icon128.png" alt="Prism Reader icon" width="96">
</p>

---

## ✨ Features

### 📰 Smart Feed Reader
- Parses **RSS 2.0**, **Atom**, and **generic XML** automatically
- Beautiful card-based grid layout with article thumbnails
- **Inline article reader** — read full content without leaving the page
- 3D tilt hover effect on cards for a premium feel

### 🏠 Dashboard
- **Your Feeds** — manage all subscriptions in one place
- **Daily Mix** — latest articles shuffled across all feeds
- **30-day activity chart** with reading stats (articles read, streak, saved count)
- Toggle between **grid** and **list** view (⊞/☰)

### 🔍 Feed Discovery
- **Auto-detects** RSS/Atom feeds on any webpage
- Badge shows detected feed count per tab
- One-click subscribe from any page

### 📦 OPML Support
- **Import** feeds from any RSS reader via OPML
- **Export** your subscriptions at any time
- **Auto-backup** — subscriptions are saved as OPML every 60 minutes in the background

### 🏷️ Keyword Watchlist
- Set keywords to track across all feeds
- Matching articles are **highlighted** with accent borders and keyword tags
- Great for monitoring topics, companies, or people

### 📖 Read Later
- Save articles to a personal reading queue
- Access saved articles from the dashboard

### 🔔 Smart Notifications
- Background feed checking every 30 minutes
- **Badge count** on the toolbar icon for new articles
- Badge clears automatically when you open the dashboard

### ⌨️ Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `j` | Next card |
| `k` | Previous card |
| `Enter` / `o` | Open focused card |
| `←` `→` | Navigate within article reader |
| `Esc` | Close article reader |

### 🎨 Theming
- **Dark mode** by default with a sleek prism-aura gradient
- **Light mode** toggle — preference persists across sessions
- Per-feed color coding for visual organization

### ⚡ Support via Lightning
- Built-in Lightning Network donation button
- QR code modal for instant tips via Wallet of Satoshi

---

## 🚀 Installation

### From Store (Recommended)
- **Chrome Web Store**: *Coming soon*
- **Edge Add-ons**: *Coming soon*

### Manual / Developer
1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/prism-reader.git
   ```
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge)
3. Enable **Developer mode**
4. Click **Load unpacked** and select the cloned folder
5. Click the Prism Reader icon on any page with an RSS feed!

---

## 📸 Screenshots

*Coming soon — dashboard, reader view, Lightning modal, and more.*

---

## 🏗️ Tech Stack

- **Vanilla JS** — zero dependencies, fast and lightweight
- **Chrome Extension Manifest V3** — modern, secure, future-proof
- **CSS3** with custom properties for theming
- **Chrome Storage API** for persistent subscriptions and settings
- **Chrome Alarms API** for background feed checking and OPML backup

---

## 📁 Project Structure

```
prism-reader/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker (alarms, badges, OPML sync)
├── content-detect.js      # Auto-detect RSS/Atom feeds on pages
├── popup.html / popup.js  # Toolbar popup (feed detection UI)
├── viewer.html / viewer.js / viewer.css  # Main reader + dashboard
├── home.html / reader.html # Entry points for dashboard & reader
├── lightning-qr.png       # Lightning Network donation QR code
└── icon*.png              # Extension icons (16, 32, 48, 128)
```

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- 🐛 Report bugs via [Issues](https://github.com/YOUR_USERNAME/prism-reader/issues)
- 💡 Suggest features
- 🔧 Submit pull requests

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## ⚡ Support

If you find Prism Reader useful, consider supporting development via the **Lightning Network**:

Click the ⚡ button in the dashboard, or scan:

<p align="center">
  <img src="lightning-qr.png" alt="Lightning QR Code" width="200">
</p>

```
LNURL1DP68GURN8GHJ7AMPD3KX2AR0VEEKZAR0WD5XJTNRDAKJ7TNHV4KXCTTTDEHHWM30D3H82UNVWQHK2MN8V9NK2ERRDAHKKWF33KZVVM
```

---

<p align="center">
  Made with 💜 by <a href="https://github.com/YOUR_USERNAME">YOUR_USERNAME</a>
</p>
