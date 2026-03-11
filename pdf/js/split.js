/* ═══════════════════════════════════════════
   Clientemente PDF — Split Tool
   ═══════════════════════════════════════════ */

(() => {
  'use strict';

  const { PDFDocument } = PDFLib;

  /* ── DOM refs ──────────────────────────── */
  const dropzone     = document.getElementById('split-dropzone');
  const fileInput    = document.getElementById('split-file-input');
  const controlsEl   = document.getElementById('split-controls');
  const pagesGrid    = document.getElementById('split-pages');
  const actionsBar   = document.getElementById('split-actions');
  const pageCountEl  = document.getElementById('split-page-count');
  const splitBtn     = document.getElementById('split-btn');
  const progressEl   = document.getElementById('split-progress');
  const progressFill = document.getElementById('split-progress-fill');
  const progressText = document.getElementById('split-progress-text');
  const resultEl     = document.getElementById('split-result');
  const rangesInput  = document.getElementById('split-ranges-input');
  const rangesField  = document.getElementById('split-ranges');
  const everyInput   = document.getElementById('split-every-input');
  const everyField   = document.getElementById('split-every-n');
  const modeBtns     = document.querySelectorAll('[data-split-mode]');

  /* ── State ─────────────────────────────── */
  let pdfBytes = null;
  let pdfDoc = null;       // pdf-lib document
  let pdfJsDoc = null;     // pdfjs document (for thumbnails)
  let totalPages = 0;
  let selectedPages = new Set();
  let mode = 'select';     // 'select' | 'ranges' | 'every'
  let fileName = 'document';

  /* ── Init ──────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    App.initDropZone(dropzone, fileInput, handleFile);
    splitBtn.addEventListener('click', doSplit);

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => switchMode(btn.dataset.splitMode));
    });
  });

  /* ── Handle file ───────────────────────── */
  async function handleFile([file]) {
    App.hide(resultEl);
    App.hide(progressEl);

    try {
      pdfBytes = await App.readFileAsArrayBuffer(file);
      pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
      totalPages = pdfDoc.getPageCount();
      fileName = file.name.replace(/\.pdf$/i, '');

      dropzone.classList.add('has-files');
      App.show(controlsEl);
      App.show(actionsBar);

      selectedPages = new Set();
      // In select mode, start with all selected
      for (let i = 1; i <= totalPages; i++) selectedPages.add(i);

      switchMode('select');
      renderPages();
    } catch (err) {
      console.error('Failed to load PDF:', err);
      alert('Could not load this PDF. It may be corrupted or password-protected.');
    }
  }

  /* ── Switch split mode ─────────────────── */
  function switchMode(newMode) {
    mode = newMode;
    modeBtns.forEach(btn => {
      btn.classList.toggle('btn-active', btn.dataset.splitMode === mode);
    });

    rangesInput.classList.toggle('hidden', mode !== 'ranges');
    everyInput.classList.toggle('hidden', mode !== 'every');

    updateCountLabel();
  }

  /* ── Render page thumbnails ────────────── */
  async function renderPages() {
    pagesGrid.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
      const thumb = document.createElement('div');
      thumb.className = 'page-thumb selected';
      thumb.dataset.page = i;

      const canvas = document.createElement('canvas');
      const label = document.createElement('span');
      label.className = 'page-thumb-label';
      label.textContent = `Page ${i}`;

      thumb.appendChild(canvas);
      thumb.appendChild(label);
      pagesGrid.appendChild(thumb);

      thumb.addEventListener('click', () => {
        if (mode !== 'select') return;
        const pg = parseInt(thumb.dataset.page);
        if (selectedPages.has(pg)) {
          selectedPages.delete(pg);
          thumb.classList.remove('selected');
        } else {
          selectedPages.add(pg);
          thumb.classList.add('selected');
        }
        updateCountLabel();
      });

      // Render thumbnail asynchronously
      App.renderPageFromDoc(pdfJsDoc, i, canvas, 140).catch(() => {});
    }

    updateCountLabel();
  }

  /* ── Update page count label ───────────── */
  function updateCountLabel() {
    if (mode === 'select') {
      pageCountEl.textContent = `${selectedPages.size} of ${totalPages} pages selected`;
    } else if (mode === 'ranges') {
      pageCountEl.textContent = `${totalPages} pages total`;
    } else {
      pageCountEl.textContent = `${totalPages} pages total`;
    }
  }

  /* ── Parse ranges string ───────────────── */
  function parseRanges(str) {
    const ranges = [];
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const match = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (match) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        if (start >= 1 && end <= totalPages && start <= end) {
          ranges.push([start, end]);
        }
      } else {
        const n = parseInt(part);
        if (!isNaN(n) && n >= 1 && n <= totalPages) {
          ranges.push([n, n]);
        }
      }
    }
    return ranges;
  }

  /* ── Build split groups ────────────────── */
  function buildGroups() {
    if (mode === 'select') {
      // Each selected page becomes its own file
      const pages = [...selectedPages].sort((a, b) => a - b);
      if (pages.length === 0) return [];
      // Group consecutive pages
      const groups = [];
      let current = [pages[0]];
      for (let i = 1; i < pages.length; i++) {
        if (pages[i] === current[current.length - 1] + 1) {
          current.push(pages[i]);
        } else {
          groups.push(current);
          current = [pages[i]];
        }
      }
      groups.push(current);
      return groups;
    } else if (mode === 'ranges') {
      const ranges = parseRanges(rangesField.value);
      return ranges.map(([start, end]) => {
        const pages = [];
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
      });
    } else {
      // Split every N
      const n = parseInt(everyField.value) || 1;
      const groups = [];
      for (let i = 1; i <= totalPages; i += n) {
        const pages = [];
        for (let j = i; j < i + n && j <= totalPages; j++) pages.push(j);
        groups.push(pages);
      }
      return groups;
    }
  }

  /* ── Do Split ──────────────────────────── */
  async function doSplit() {
    const groups = buildGroups();
    if (groups.length === 0) {
      alert('No pages selected. Please select at least one page.');
      return;
    }

    App.show(progressEl);
    App.hide(resultEl);
    splitBtn.disabled = true;
    progressFill.style.width = '0%';

    try {
      const results = []; // { name, blob }

      for (let i = 0; i < groups.length; i++) {
        const pages = groups[i];
        progressText.textContent = `Creating file ${i + 1} of ${groups.length}…`;
        progressFill.style.width = `${((i + 1) / groups.length) * 90}%`;

        const newPdf = await PDFDocument.create();
        const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const indices = pages.map(p => p - 1); // 0-indexed
        const copiedPages = await newPdf.copyPages(srcDoc, indices);
        copiedPages.forEach(page => newPdf.addPage(page));

        const bytes = await newPdf.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });

        const rangeName = pages.length === 1
          ? `page${pages[0]}`
          : `pages${pages[0]}-${pages[pages.length - 1]}`;

        results.push({
          name: `${fileName}_${rangeName}.pdf`,
          blob,
          size: bytes.length,
        });
      }

      progressFill.style.width = '100%';
      progressText.textContent = 'Done!';

      // Render results
      resultEl.innerHTML = `
        <p class="result-text">✅ Split into ${results.length} file${results.length > 1 ? 's' : ''}</p>
        ${results.length > 1 ? '<button class="btn btn-success btn-lg" id="split-download-all">Download All</button>' : ''}
        <div class="result-downloads" style="margin-top:.75rem">
          ${results.map((r, i) => {
            const url = URL.createObjectURL(r.blob);
            return `<a class="btn btn-primary" href="${url}" download="${r.name}">
              ${r.name} <small>(${App.formatSize(r.size)})</small>
            </a>`;
          }).join('')}
        </div>
      `;

      // Download all
      const downloadAllBtn = resultEl.querySelector('#split-download-all');
      if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', () => {
          results.forEach((r, i) => {
            setTimeout(() => App.downloadBlob(r.blob, r.name), i * 200);
          });
        });
      }

      App.show(resultEl);
    } catch (err) {
      console.error('Split failed:', err);
      progressText.textContent = '❌ Split failed. Check the console for details.';
    } finally {
      splitBtn.disabled = false;
    }
  }
})();
