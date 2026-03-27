/* ═══════════════════════════════════════════
   Clientemente PDF — Compress Tool
   ═══════════════════════════════════════════ */

(() => {
  'use strict';

  const { PDFDocument } = PDFLib;

  const PRESETS = {
    low: {
      label: 'Low',
      scale: 1,
      quality: 0.82,
      note: 'Lightest compression with higher visual quality.'
    },
    medium: {
      label: 'Medium',
      scale: 0.82,
      quality: 0.64,
      note: 'Balanced compression for most scanned PDFs.'
    },
    high: {
      label: 'High',
      scale: 0.62,
      quality: 0.45,
      note: 'Strongest reduction with the highest loss in detail.'
    }
  };

  const dropzone = document.getElementById('compress-dropzone');
  const fileInput = document.getElementById('compress-file-input');
  const workspaceEl = document.getElementById('compress-workspace');
  const fileNameEl = document.getElementById('compress-file-name');
  const filePagesEl = document.getElementById('compress-file-pages');
  const fileSizeEl = document.getElementById('compress-file-size');
  const presetButtons = document.querySelectorAll('.compress-preset');
  const presetMetaEl = document.getElementById('compress-preset-meta');
  const compressBtn = document.getElementById('compress-btn');
  const progressEl = document.getElementById('compress-progress');
  const progressFill = document.getElementById('compress-progress-fill');
  const progressText = document.getElementById('compress-progress-text');
  const resultEl = document.getElementById('compress-result');
  const resultText = document.getElementById('compress-result-text');
  const resultNote = document.getElementById('compress-result-note');
  const originalSizeEl = document.getElementById('compress-original-size');
  const newSizeEl = document.getElementById('compress-new-size');
  const savedSizeEl = document.getElementById('compress-saved-size');
  const downloadEl = document.getElementById('compress-download');

  let selectedPreset = 'low';
  let currentFile = null;
  let pdfBytes = null;
  let pageCount = 0;
  let fileStem = 'document';
  let downloadUrl = null;

  document.addEventListener('DOMContentLoaded', () => {
    App.initDropZone(dropzone, fileInput, handleFile);
    compressBtn.addEventListener('click', doCompress);

    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => setPreset(btn.dataset.compressPreset));
    });

    setPreset(selectedPreset);
  });

  async function handleFile([file]) {
    clearDownloadUrl();
    App.hide(resultEl);
    App.hide(progressEl);

    try {
      const bytes = await App.readFileAsArrayBuffer(file);
      const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

      currentFile = file;
      pdfBytes = bytes;
      pageCount = pdfDoc.getPageCount();
      fileStem = file.name.replace(/\.pdf$/i, '') || 'document';

      fileNameEl.textContent = file.name;
      filePagesEl.textContent = `${pageCount} page${pageCount !== 1 ? 's' : ''}`;
      fileSizeEl.textContent = App.formatSize(file.size);

      dropzone.classList.add('has-files');
      App.show(workspaceEl);
    } catch (err) {
      console.error('Failed to load PDF for compression:', err);
      alert('Could not load this PDF. It may be corrupted or password-protected.');
    }
  }

  function setPreset(presetKey) {
    if (!PRESETS[presetKey]) return;

    selectedPreset = presetKey;
    presetButtons.forEach(btn => {
      btn.classList.toggle('btn-active', btn.dataset.compressPreset === presetKey);
    });
    presetMetaEl.textContent = PRESETS[presetKey].note;
  }

  async function doCompress() {
    if (!currentFile || !pdfBytes) {
      alert('Please choose a PDF first.');
      return;
    }

    const preset = PRESETS[selectedPreset];
    App.show(progressEl);
    App.hide(resultEl);
    compressBtn.disabled = true;
    progressFill.style.width = '0%';
    progressText.textContent = `Preparing ${preset.label.toLowerCase()} compression…`;

    try {
      const pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
      const newPdf = await PDFDocument.create();

      for (let pageIndex = 1; pageIndex <= pdfJsDoc.numPages; pageIndex++) {
        const phaseBase = ((pageIndex - 1) / pdfJsDoc.numPages) * 90;
        progressText.textContent = `Compressing page ${pageIndex} of ${pdfJsDoc.numPages}…`;
        progressFill.style.width = `${phaseBase}%`;

        const page = await pdfJsDoc.getPage(pageIndex);
        const baseViewport = page.getViewport({ scale: 1 });
        const renderScale = Math.max(preset.scale, 0.35);
        const renderViewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: false });

        canvas.width = Math.max(1, Math.floor(renderViewport.width));
        canvas.height = Math.max(1, Math.floor(renderViewport.height));

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport: renderViewport,
          background: 'rgb(255,255,255)'
        }).promise;

        progressFill.style.width = `${phaseBase + 45 / pdfJsDoc.numPages}%`;

        const jpegBytes = await canvasToJpegBytes(canvas, preset.quality);
        const image = await newPdf.embedJpg(jpegBytes);
        const newPage = newPdf.addPage([baseViewport.width, baseViewport.height]);
        newPage.drawImage(image, {
          x: 0,
          y: 0,
          width: baseViewport.width,
          height: baseViewport.height,
        });
        progressFill.style.width = `${((pageIndex) / pdfJsDoc.numPages) * 90}%`;
      }

      progressText.textContent = 'Saving compressed PDF…';
      progressFill.style.width = '95%';

      newPdf.setTitle(`${fileStem} (compressed)`);
      newPdf.setProducer('Clientemente PDF');
      newPdf.setCreator('Clientemente PDF');

      const outputBytes = await newPdf.save();
      const blob = new Blob([outputBytes], { type: 'application/pdf' });

      progressFill.style.width = '100%';
      progressText.textContent = `Done! ${App.formatSize(outputBytes.length)}`;

      renderResult(outputBytes.length, blob);

      if (pdfJsDoc && typeof pdfJsDoc.destroy === 'function') {
        pdfJsDoc.destroy();
      }
    } catch (err) {
      console.error('Compression failed:', err);
      progressText.textContent = '❌ Compression failed. Check the console for details.';
    } finally {
      compressBtn.disabled = false;
    }
  }

  function renderResult(outputSize, blob) {
    const inputSize = currentFile ? currentFile.size : pdfBytes.length;
    const diff = inputSize - outputSize;
    const percent = inputSize > 0 ? (Math.abs(diff) / inputSize) * 100 : 0;

    originalSizeEl.textContent = App.formatSize(inputSize);
    newSizeEl.textContent = App.formatSize(outputSize);

    if (diff >= 0) {
      resultText.textContent = 'Compression complete.';
      savedSizeEl.textContent = `${percent.toFixed(1)}% smaller`;
      resultNote.textContent = diff > 0
        ? `Saved ${App.formatSize(diff)} with the ${PRESETS[selectedPreset].label.toLowerCase()} preset.`
        : 'This file did not change in size. Try a stronger preset if you need a smaller download.';
    } else {
      resultText.textContent = 'Compression complete, but this version is larger.';
      savedSizeEl.textContent = `${percent.toFixed(1)}% larger`;
      resultNote.textContent = 'This can happen with text-heavy or vector PDFs. The original file may already be efficiently encoded.';
    }

    clearDownloadUrl();
    downloadUrl = URL.createObjectURL(blob);
    downloadEl.href = downloadUrl;
    downloadEl.download = `${fileStem}-compressed.pdf`;
    downloadEl.onclick = () => {
      setTimeout(clearDownloadUrl, 1000);
    };

    App.show(resultEl);
  }

  function clearDownloadUrl() {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      downloadUrl = null;
    }
  }

  function canvasToJpegBytes(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(async blob => {
        if (!blob) {
          reject(new Error('Failed to encode JPEG image.'));
          return;
        }

        try {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          resolve(bytes);
        } catch (err) {
          reject(err);
        }
      }, 'image/jpeg', quality);
    });
  }
})();