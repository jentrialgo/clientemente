/* ═══════════════════════════════════════════
   Clientemente Shared — Core JS (Theming, Routing, Utilities)
   ═══════════════════════════════════════════ */

const SharedCore = (() => {
  'use strict';

  /* ── Router ────────────────────────────── */
  function navigate(viewId) {
    const views = document.querySelectorAll('.view');
    views.forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewId}`);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      history.replaceState(null, '', viewId === 'home' || !viewId ? '#' : `#${viewId}`);
    }
  }

  function initRouter(options = {}) {
    const { toolCards, backBtns } = options;

    if (toolCards) {
      toolCards.forEach(card => {
        card.addEventListener('click', () => navigate(card.dataset.tool));
      });
    }

    if (backBtns) {
      backBtns.forEach(btn => {
        btn.addEventListener('click', () => navigate(btn.dataset.nav));
      });
    }

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
  function initTheme(themeToggleEl) {
    const stored = localStorage.getItem('clientemente-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    applyTheme(theme, themeToggleEl);

    if (themeToggleEl) {
      themeToggleEl.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next, themeToggleEl);
        localStorage.setItem('clientemente-theme', next);
      });
    }
  }

  function applyTheme(theme, themeToggleEl) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggleEl) {
      const iconEl = themeToggleEl.querySelector('.theme-icon');
      if (iconEl) {
        iconEl.textContent = theme === 'dark' ? '☀️' : '🌙';
      }
    }
  }

  /* ── Drag & Drop Zone Helper ───────────── */
  function initDropZone(dropzoneEl, fileInputEl, onFiles, opts = {}) {
    const multiple = opts.multiple ?? false;
    const accept = opts.accept ?? '*/*';

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
      const files = [...e.dataTransfer.files];
      if (files.length) {
        onFiles(multiple ? files : [files[0]]);
      }
    });
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
  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }

  // Public API
  return {
    navigate,
    initRouter,
    initTheme,
    initDropZone,
    formatSize,
    downloadBlob,
    readFileAsArrayBuffer,
    show,
    hide,
  };
})();
