# Clientemente

Clientemente is a suite of pure client-side, browser-based tools designed for privacy, speed, and simplicity. There are no backend servers, no file uploads, and no registrations—all processing happens entirely on your device inside your web browser. 

## 🛠️ Included Tools

* **📄 PDF Tools:** Merge, split, rotate, and reorder PDF pages securely. Built with [pdf-lib](https://pdf-lib.js.org/) and pdf.js.
* **🖼️ Image Tools:** Resize, compress, crop, and make perfect circular profile photos without uploading them anywhere.
* **🧜‍♀️ Mermaid Editor:** Write and render Mermaid.js diagrams directly in your browser with live preview and high-resolution exports.
* **📱 QR Generator:** Generate secure QR codes for URLs, WiFi networks, and plain text. Built with qrcodejs.
* **🎓 Quiz Maker:** Host and play interactive real-time quizzes using true peer-to-peer WebRTC connections (via [PeerJS](https://peerjs.com/)). No central server needed for the game logic or state.

## 🔒 Privacy First

* **100% Client-Side Processing:** Your data and local files never leave your computer.
* **Zero Registration:** No accounts, no logins, no paywalls.
* **No Cloud Storage:** We don't have servers that see or store your data.
* **Fast & Offline Compatible:** Because everything runs on your device, it's lightning fast. Once the app loads, most tools work completely offline.

## 🚀 Getting Started

Since Clientemente is entirely front-end, there are no build steps or dependencies to compile. Simply open `index.html` in your favorite modern web browser, or host the repository using any static web server (like GitHub Pages, Vercel, Netlify, or a local development server).

1. Clone the repository:
   ```bash
   git clone https://github.com/jentrialgo/clientemente.git
   ```
2. Navigate into the directory:
   ```bash
   cd clientemente
   ```
3. Open `index.html` in your browser, or start a simple local server:
   ```bash
   python -m http.server 8000
   ```

## 📜 Authors & License

Created by [jentrialgo](https://github.com/jentrialgo). Open source and local-first.
