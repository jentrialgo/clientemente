/* ═══════════════════════════════════════════
   Clientemente QR — App Controller
   ═══════════════════════════════════════════ */

const App = (() => {
  'use strict';

  /* ── Init ──────────────────────────────── */
  function init() {
    SharedCore.initRouter({
      toolCards: document.querySelectorAll('.tool-card'),
      backBtns: document.querySelectorAll('.back-btn'),
      logoLink: document.getElementById('logo-link')
    });
    
    SharedCore.initTheme(document.getElementById('theme-toggle'));

    // Initialize individual tool listeners (from qr.js)
    if (typeof QRGenerator !== 'undefined') {
      QRGenerator.init();
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // Public API + Forwarding to SharedCore
  return {
    ...SharedCore
  };
})();
