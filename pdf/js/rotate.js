/* ═══════════════════════════════════════════
   Private PDF — Rotate & Reorder Tool
   ═══════════════════════════════════════════ */

(() => {
  'use strict';

  const { PDFDocument, degrees } = PDFLib;

  /* ── DOM refs ──────────────────────────── */
  const dropzone     = document.getElementById('rotate-dropzone');
  const fileInput    = document.getElementById('rotate-file-input');
  const toolbar      = document.getElementById('rotate-toolbar');
  const pagesGrid    = document.getElementById('rotate-pages');
  const actionsBar   = document.getElementById('rotate-actions');
  const pageCountEl  = document.getElementById('rotate-page-count');
  const saveBtn      = document.getElementById('rotate-btn');
  const progressEl   = document.getElementById('rotate-progress');
  const progressFill = document.getElementById('rotate-progress-fill');
  const progressText = document.getElementById('rotate-progress-text');
  const resultEl     = document.getElementById('rotate-result');
  const downloadEl   = document.getElementById('rotate-download');

  const rotateAllLeftBtn  = document.getElementById('rotate-all-left');
  const rotateAllRightBtn = document.getElementById('rotate-all-right');
  const removeSelectedBtn = document.getElementById('rotate-remove-selected');

  /* ── State ─────────────────────────────── */
  let pdfBytes = null;
  let pdfJsDoc = null;
  let pages = []; // { pageNum (original), rotation, selected, id }
  let nextId = 0;
  let sortable = null;
  let fileName = 'document';

  /* ── Init ──────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    App.initDropZone(dropzone, fileInput, handleFile);
    saveBtn.addEventListener('click', doSave);
    rotateAllLeftBtn.addEventListener('click', () => rotateAll(-90));
    rotateAllRightBtn.addEventListener('click', () => rotateAll(90));
    removeSelectedBtn.addEventListener('click', removeSelected);
  });

  /* ── Handle file ───────────────────────── */
  async function handleFile([file]) {
    App.hide(resultEl);
    App.hide(progressEl);

    try {
      pdfBytes = await App.readFileAsArrayBuffer(file);
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
      const totalPages = pdfDoc.getPageCount();
      fileName = file.name.replace(/\.pdf$/i, '');

      pages = [];
      for (let i = 1; i <= totalPages; i++) {
        pages.push({
          id: nextId++,
          pageNum: i,
          rotation: 0,
          selected: false,
        });
      }

      dropzone.classList.add('has-files');
      App.show(toolbar);
      App.show(actionsBar);

      renderPages();
    } catch (err) {
      console.error('Failed to load PDF:', err);
      alert('Could not load this PDF. It may be corrupted or password-protected.');
    }
  }

  /* ── Render page grid ──────────────────── */
  function renderPages() {
    pagesGrid.innerHTML = '';

    pages.forEach((pg, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'page-thumb' + (pg.selected ? ' selected' : '');
      thumb.dataset.id = pg.id;
      thumb.dataset.rotation = pg.rotation;

      // Rotation badge
      const badge = document.createElement('span');
      badge.className = 'page-rotation-badge';
      badge.textContent = `${pg.rotation}°`;

      // Canvas
      const canvas = document.createElement('canvas');
      canvas.style.transform = `rotate(${pg.rotation}deg)`;

      // Label
      const label = document.createElement('span');
      label.className = 'page-thumb-label';
      label.textContent = `Page ${pg.pageNum}`;

      // Action buttons
      const actions = document.createElement('div');
      actions.className = 'page-thumb-actions';

      const rotLeftBtn = createBtn('↺', 'Rotate left', () => {
        rotatePage(pg.id, -90);
      });
      const rotRightBtn = createBtn('↻', 'Rotate right', () => {
        rotatePage(pg.id, 90);
      });
      const removeBtn = createBtn('✕', 'Remove page', () => {
        pages = pages.filter(p => p.id !== pg.id);
        renderPages();
      });
      removeBtn.classList.add('danger');

      actions.appendChild(rotLeftBtn);
      actions.appendChild(rotRightBtn);
      actions.appendChild(removeBtn);

      thumb.appendChild(badge);
      thumb.appendChild(canvas);
      thumb.appendChild(label);
      thumb.appendChild(actions);
      pagesGrid.appendChild(thumb);

      // Click to select
      thumb.addEventListener('click', e => {
        if (e.target.closest('.page-thumb-btn')) return;
        pg.selected = !pg.selected;
        thumb.classList.toggle('selected', pg.selected);
        updateCountLabel();
      });

      // Render thumbnail
      App.renderPageFromDoc(pdfJsDoc, pg.pageNum, canvas, 140).catch(() => {});
    });

    // Init sortable
    if (sortable) sortable.destroy();
    sortable = Sortable.create(pagesGrid, {
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: () => {
        const newOrder = [...pagesGrid.querySelectorAll('.page-thumb')].map(el =>
          parseInt(el.dataset.id)
        );
        pages = newOrder.map(id => pages.find(p => p.id === id));
      },
    });

    updateCountLabel();
  }

  /* ── Helper: create small button ───────── */
  function createBtn(icon, title, onClick) {
    const btn = document.createElement('button');
    btn.className = 'page-thumb-btn';
    btn.textContent = icon;
    btn.title = title;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  /* ── Rotate a single page ──────────────── */
  function rotatePage(id, deg) {
    const pg = pages.find(p => p.id === id);
    if (!pg) return;
    pg.rotation = ((pg.rotation + deg) % 360 + 360) % 360;

    const thumb = pagesGrid.querySelector(`.page-thumb[data-id="${id}"]`);
    if (thumb) {
      thumb.dataset.rotation = pg.rotation;
      thumb.querySelector('canvas').style.transform = `rotate(${pg.rotation}deg)`;
      thumb.querySelector('.page-rotation-badge').textContent = `${pg.rotation}°`;
    }
  }

  /* ── Rotate all pages ──────────────────── */
  function rotateAll(deg) {
    pages.forEach(pg => {
      pg.rotation = ((pg.rotation + deg) % 360 + 360) % 360;
    });
    renderPages();
  }

  /* ── Remove selected ───────────────────── */
  function removeSelected() {
    const selCount = pages.filter(p => p.selected).length;
    if (selCount === 0) {
      alert('No pages selected. Click pages to select them first.');
      return;
    }
    if (selCount === pages.length) {
      alert('Cannot remove all pages. At least one page must remain.');
      return;
    }
    pages = pages.filter(p => !p.selected);
    renderPages();
  }

  /* ── Update count label ────────────────── */
  function updateCountLabel() {
    const selCount = pages.filter(p => p.selected).length;
    pageCountEl.textContent = `${pages.length} page${pages.length !== 1 ? 's' : ''}` +
      (selCount > 0 ? ` · ${selCount} selected` : '');
  }

  /* ── Save ──────────────────────────────── */
  async function doSave() {
    if (pages.length === 0) {
      alert('No pages remaining.');
      return;
    }

    App.show(progressEl);
    App.hide(resultEl);
    saveBtn.disabled = true;
    progressFill.style.width = '0%';
    progressText.textContent = 'Processing…';

    try {
      const newPdf = await PDFDocument.create();
      const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

      const indices = pages.map(p => p.pageNum - 1);
      const copiedPages = await newPdf.copyPages(srcDoc, indices);

      copiedPages.forEach((page, i) => {
        // Apply rotation
        const rot = pages[i].rotation;
        if (rot !== 0) {
          const existing = page.getRotation().angle;
          page.setRotation(degrees((existing + rot) % 360));
        }
        newPdf.addPage(page);

        progressFill.style.width = `${((i + 1) / copiedPages.length) * 90}%`;
      });

      progressText.textContent = 'Saving…';
      progressFill.style.width = '95%';

      const outputBytes = await newPdf.save();
      const blob = new Blob([outputBytes], { type: 'application/pdf' });

      progressFill.style.width = '100%';
      progressText.textContent = `Done! ${App.formatSize(outputBytes.length)}`;

      const url = URL.createObjectURL(blob);
      downloadEl.href = url;
      downloadEl.download = `${fileName}_modified.pdf`;
      downloadEl.onclick = () => {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };

      App.show(resultEl);
    } catch (err) {
      console.error('Save failed:', err);
      progressText.textContent = '❌ Save failed. Check the console for details.';
    } finally {
      saveBtn.disabled = false;
    }
  }
})();
