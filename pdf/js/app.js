/* ═══════════════════════════════════════════
   Clientemente PDF — App Shell (Router + Helpers)
   ═══════════════════════════════════════════ */

const App = (() => {
  'use strict';

  /* ── DOM refs ──────────────────────────── */
  const views = document.querySelectorAll('.view');
  const toolCards = document.querySelectorAll('.tool-card');
  const backBtns = document.querySelectorAll('.back-btn');
  const themeToggle = document.getElementById('theme-toggle');
  const logoLink = document.getElementById('logo-link');

  /* ── Router ────────────────────────────── */
  function navigate(viewId) {
    views.forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewId}`);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      history.replaceState(null, '', viewId === 'home' ? '#' : `#${viewId}`);
    }
  }

  function initRouter() {
    toolCards.forEach(card => {
      card.addEventListener('click', () => navigate(card.dataset.tool));
    });

    backBtns.forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.nav));
    });

    logoLink.addEventListener('click', e => {
      e.preventDefault();
      navigate('home');
    });

    // Handle browser back/forward
    window.addEventListener('hashchange', () => {
      const hash = location.hash.replace('#', '') || 'home';
      navigate(hash);
    });

    // Initial route
    const initial = location.hash.replace('#', '') || 'home';
    navigate(initial);
  }

  /* ── Theme Toggle ──────────────────────── */
  function initTheme() {
    const stored = localStorage.getItem('ppdf-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);

    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('ppdf-theme', next);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  /* ── Drag & Drop Zone Helper ───────────── */
  function initDropZone(dropzoneEl, fileInputEl, onFiles, opts = {}) {
    const multiple = opts.multiple ?? false;
    const accept = opts.accept ?? '.pdf';

    // Click to open
    dropzoneEl.addEventListener('click', e => {
      if (e.target.closest('label') || e.target.closest('input')) return;
      fileInputEl.click();
    });

    fileInputEl.addEventListener('change', () => {
      if (fileInputEl.files.length) {
        onFiles([...fileInputEl.files]);
        fileInputEl.value = '';
      }
    });

    // Drag events
    ['dragenter', 'dragover'].forEach(evt => {
      dropzoneEl.addEventListener(evt, e => {
        e.preventDefault();
        dropzoneEl.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropzoneEl.addEventListener(evt, e => {
        e.preventDefault();
        dropzoneEl.classList.remove('drag-over');
      });
    });
    dropzoneEl.addEventListener('drop', e => {
      const files = [...e.dataTransfer.files].filter(f => f.type === 'application/pdf');
      if (files.length) {
        onFiles(multiple ? files : [files[0]]);
      }
    });
  }

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

  /* ── File size formatting ──────────────── */
  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /* ── Download helper ───────────────────── */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /* ── Read file as ArrayBuffer ──────────── */
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  /* ── Show / hide helpers ───────────────── */
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  /* ── Init ──────────────────────────────── */
  function init() {
    initRouter();
    initTheme();
  }

  document.addEventListener('DOMContentLoaded', init);

  // Public API
  return {
    navigate,
    initDropZone,
    renderPageThumb,
    renderPageFromDoc,
    formatSize,
    downloadBlob,
    readFileAsArrayBuffer,
    show,
    hide,
  };
})();
