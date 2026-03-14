/* ═══════════════════════════════════════════
   Clientemente PDF — App Controller
   ═══════════════════════════════════════════ */

const App = (() => {
  'use strict';

  /* ── Render PDF page thumbnail ─────────── */
  async function renderPageThumb(pdfBytes, pageNum, canvas, maxWidth = 140) {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNum);
    const vp = page.getViewport({ scale: 1 });
    const scale = maxWidth / vp.width;
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    pdf.destroy();
  }

  /* Render a single page from an already-loaded pdfjsLib document */
  async function renderPageFromDoc(pdfDoc, pageNum, canvas, maxWidth = 140) {
    const page = await pdfDoc.getPage(pageNum);
    const vp = page.getViewport({ scale: 1 });
    const scale = maxWidth / vp.width;
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  /* ── Init ──────────────────────────────── */
  function init() {
    SharedCore.initRouter({
      toolCards: document.querySelectorAll('.tool-card'),
      backBtns: document.querySelectorAll('.back-btn'),
      logoLink: document.getElementById('logo-link')
    });
    
    SharedCore.initTheme(document.getElementById('theme-toggle'));
  }

  document.addEventListener('DOMContentLoaded', init);

  // Public API + Forwarding to SharedCore
  return {
    ...SharedCore,
    renderPageThumb,
    renderPageFromDoc,
  };
})();
