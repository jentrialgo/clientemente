/* ═══════════════════════════════════════════
   Private PDF — Merge Tool
   ═══════════════════════════════════════════ */

(() => {
  'use strict';

  const { PDFDocument } = PDFLib;

  /* ── DOM refs ──────────────────────────── */
  const dropzone   = document.getElementById('merge-dropzone');
  const fileInput  = document.getElementById('merge-file-input');
  const fileList   = document.getElementById('merge-file-list');
  const actionsBar = document.getElementById('merge-actions');
  const fileCount  = document.getElementById('merge-file-count');
  const mergeBtn   = document.getElementById('merge-btn');
  const progressEl = document.getElementById('merge-progress');
  const progressFill = document.getElementById('merge-progress-fill');
  const progressText = document.getElementById('merge-progress-text');
  const resultEl   = document.getElementById('merge-result');
  const downloadEl = document.getElementById('merge-download');

  /* ── State ─────────────────────────────── */
  let files = []; // { id, name, size, bytes, pageCount }
  let nextId = 0;
  let sortable = null;

  /* ── Init ──────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    App.initDropZone(dropzone, fileInput, handleNewFiles, { multiple: true });
    mergeBtn.addEventListener('click', doMerge);
  });

  /* ── Handle new files ──────────────────── */
  async function handleNewFiles(fileObjs) {
    App.hide(resultEl);
    App.hide(progressEl);

    for (const f of fileObjs) {
      try {
        const bytes = await App.readFileAsArrayBuffer(f);
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pageCount = pdf.getPageCount();
        files.push({
          id: nextId++,
          name: f.name,
          size: f.size,
          bytes,
          pageCount,
        });
      } catch (err) {
        console.error(`Failed to load ${f.name}:`, err);
        alert(`Could not load "${f.name}". It may be corrupted or password-protected.`);
      }
    }

    renderFileList();
  }

  /* ── Render file list ──────────────────── */
  function renderFileList() {
    if (files.length === 0) {
      fileList.innerHTML = '';
      dropzone.classList.remove('has-files');
      App.hide(actionsBar);
      return;
    }

    dropzone.classList.add('has-files');
    App.show(actionsBar);

    const totalPages = files.reduce((s, f) => s + f.pageCount, 0);
    fileCount.textContent = `${files.length} file${files.length > 1 ? 's' : ''} · ${totalPages} page${totalPages > 1 ? 's' : ''}`;

    fileList.innerHTML = files
      .map(f => `
        <div class="file-item" data-id="${f.id}">
          <span class="file-item-drag" title="Drag to reorder">⠿</span>
          <canvas class="file-item-thumb" data-file-id="${f.id}"></canvas>
          <div class="file-item-info">
            <div class="file-item-name">${escapeHtml(f.name)}</div>
            <div class="file-item-meta">${f.pageCount} page${f.pageCount > 1 ? 's' : ''} · ${App.formatSize(f.size)}</div>
          </div>
          <button class="file-item-remove" data-remove-id="${f.id}" title="Remove">✕</button>
        </div>
      `)
      .join('');

    // Render thumbnails
    files.forEach(f => {
      const canvas = fileList.querySelector(`canvas[data-file-id="${f.id}"]`);
      if (canvas) {
        App.renderPageThumb(f.bytes.slice(), 1, canvas, 40).catch(() => {});
      }
    });

    // Remove buttons
    fileList.querySelectorAll('.file-item-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.removeId);
        files = files.filter(f => f.id !== id);
        renderFileList();
      });
    });

    // Sortable
    if (sortable) sortable.destroy();
    sortable = Sortable.create(fileList, {
      animation: 200,
      handle: '.file-item-drag',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: () => {
        const newOrder = [...fileList.querySelectorAll('.file-item')].map(el =>
          parseInt(el.dataset.id)
        );
        files = newOrder.map(id => files.find(f => f.id === id));
        // Update count display
        const totalPages = files.reduce((s, f) => s + f.pageCount, 0);
        fileCount.textContent = `${files.length} file${files.length > 1 ? 's' : ''} · ${totalPages} page${totalPages > 1 ? 's' : ''}`;
      },
    });

    // Show add more button via drop zone
    // Re-show drop zone as a small "add more" target
    dropzone.classList.remove('has-files');
    dropzone.style.padding = '1rem';
    dropzone.querySelector('.drop-zone-text').textContent = 'Add more PDFs';
    dropzone.querySelector('.drop-zone-icon').style.display = 'none';
    dropzone.querySelector('.drop-zone-or').style.display = 'none';
  }

  /* ── Merge ─────────────────────────────── */
  async function doMerge() {
    if (files.length < 2) {
      alert('Please add at least 2 PDF files to merge.');
      return;
    }

    App.show(progressEl);
    App.hide(resultEl);
    mergeBtn.disabled = true;
    progressFill.style.width = '0%';
    progressText.textContent = 'Merging…';

    try {
      const merged = await PDFDocument.create();
      const total = files.length;

      for (let i = 0; i < total; i++) {
        progressText.textContent = `Merging file ${i + 1} of ${total}…`;
        progressFill.style.width = `${((i + 1) / total) * 90}%`;

        const donor = await PDFDocument.load(files[i].bytes, { ignoreEncryption: true });
        const indices = donor.getPageIndices();
        const copiedPages = await merged.copyPages(donor, indices);
        copiedPages.forEach(page => merged.addPage(page));
      }

      progressText.textContent = 'Saving…';
      progressFill.style.width = '95%';

      const pdfBytes = await merged.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      progressFill.style.width = '100%';
      progressText.textContent = `Done! ${App.formatSize(pdfBytes.length)}`;

      // Set up download
      const url = URL.createObjectURL(blob);
      downloadEl.href = url;
      downloadEl.download = 'merged.pdf';
      downloadEl.onclick = () => {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };

      App.show(resultEl);
    } catch (err) {
      console.error('Merge failed:', err);
      progressText.textContent = '❌ Merge failed. Check the console for details.';
    } finally {
      mergeBtn.disabled = false;
    }
  }

  /* ── Util ──────────────────────────────── */
  function escapeHtml(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }
})();
