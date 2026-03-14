/* ═══════════════════════════════════════════
   Clientemente QR — Logic
   ═══════════════════════════════════════════ */

const QRGenerator = (() => {
  'use strict';

  let currentQR = null;

  /* ── Core Generation Logic ─────────────── */
  function generate(containerId, content) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear old QR
    container.innerHTML = '';

    // Create a square drawing area
    const size = 256;

    // Generate QR using qrcodejs
    currentQR = new QRCode(container, {
      text: content,
      width: size,
      height: size,
      colorDark : "#000000",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.H
    });

    // Make content available for download after a tiny delay for qrcode.js to render
    setTimeout(() => {
      const img = container.querySelector('img');
      if (img && img.src) {
        // We'll use the img source directly for downloading
      }
    }, 100);
  }

  /* ── Form Data to QR Content ───────────── */
  function getWiFiContent() {
    const ssid = document.getElementById('wifi-ssid').value;
    const pass = document.getElementById('wifi-pass').value;
    const sec = document.getElementById('wifi-sec').value;
    
    // Formatting: WIFI:S:ssid;T:WPA;P:password;;
    return `WIFI:T:${sec};S:${ssid};P:${pass};;`;
  }

  /* ── Download ──────────────────────────── */
  function setupDownload(btnId, containerId, filenameBase) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener('click', () => {
      const container = document.getElementById(containerId);
      const img = container.querySelector('img');
      const canvas = container.querySelector('canvas');
      
      let dataUrl = '';
      if (img && img.src && img.src.startsWith('data:')) {
        dataUrl = img.src;
      } else if (canvas) {
        dataUrl = canvas.toDataURL("image/png");
      }

      if (dataUrl) {
        const link = document.createElement('a');
        link.download = `${filenameBase}-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }
    });
  }

  /* ── Initialization ────────────────────── */
  function init() {
    // URL QR setup
    const inputUrl = document.getElementById('input-url');
    if (inputUrl) {
      inputUrl.addEventListener('input', () => {
        generate('qrcode-url', inputUrl.value || 'https://');
      });
      // Initial generation
      generate('qrcode-url', inputUrl.value || 'https://');
    }
    setupDownload('download-url', 'qrcode-url', 'link-qr');

    // WiFi QR setup
    const wifiSSID = document.getElementById('wifi-ssid');
    const wifiPass = document.getElementById('wifi-pass');
    const wifiSec = document.getElementById('wifi-sec');
    const wifiInputs = [wifiSSID, wifiPass, wifiSec];

    wifiInputs.forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          generate('qrcode-wifi', getWiFiContent());
        });
      }
    });
    // Initial generation (blank)
    generate('qrcode-wifi', 'WIFI:T:WPA;S:;P:;;');
    setupDownload('download-wifi', 'qrcode-wifi', 'wifi-qr');

    // Text QR setup
    const inputText = document.getElementById('input-text');
    if (inputText) {
      inputText.addEventListener('input', () => {
        generate('qrcode-text', inputText.value || ' ');
      });
      // Initial generation
      generate('qrcode-text', ' ');
    }
    setupDownload('download-text', 'qrcode-text', 'text-qr');
  }

  return { init };
})();
