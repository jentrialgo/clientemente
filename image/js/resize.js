document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('resize-dropzone');
  const fileInput = document.getElementById('resize-file');
  const workspace = document.getElementById('resize-workspace');
  
  const canvas = document.getElementById('resize-canvas');
  const ctx = canvas.getContext('2d');
  const metaObj = document.getElementById('resize-meta');
  
  const widthInput = document.getElementById('resize-width');
  const heightInput = document.getElementById('resize-height');
  const lockRatio = document.getElementById('resize-lock-ratio');
  const formatSelect = document.getElementById('resize-format');
  const qualityInput = document.getElementById('resize-quality');
  const qualityVal = document.getElementById('resize-quality-val');
  const qualityGroup = document.getElementById('resize-quality-group');
  
  const btnDownload = document.getElementById('resize-download');
  const btnCopy = document.getElementById('resize-copy');
  const btnReset = document.getElementById('resize-reset');

  let currentImage = null;
  let originalRatio = 1;
  let originalFile = null;

  SharedCore.initDropZone(dropzone, fileInput, async (files) => {
    if (!files || !files[0]) return;
    originalFile = files[0];
    
    try {
      currentImage = await ImageUtils.loadImage(originalFile);
      originalRatio = currentImage.width / currentImage.height;
      
      // Init inputs
      widthInput.value = currentImage.width;
      heightInput.value = currentImage.height;
      formatSelect.value = originalFile.type === 'image/jpeg' ? 'image/jpeg' : (originalFile.type === 'image/webp' ? 'image/webp' : 'image/png');
      updateQualityVisibility();
      
      metaObj.textContent = "Original: " + currentImage.width + "x" + currentImage.height + "px (" + SharedCore.formatSize(originalFile.size) + ")";

      updateCanvas();
      
      SharedCore.hide(dropzone);
      SharedCore.show(workspace);
    } catch (e) {
      alert('Could not load image');
    }
  }, { accept: 'image/*' });

  function updateQualityVisibility() {
    if (formatSelect.value === 'image/png') {
      qualityGroup.style.display = 'none';
    } else {
      qualityGroup.style.display = 'flex';
    }
  }

  function updateCanvas() {
    if (!currentImage) return;
    const w = parseInt(widthInput.value) || currentImage.width;
    const h = parseInt(heightInput.value) || currentImage.height;
    
    canvas.width = w;
    canvas.height = h;
    
    // Fill background for formats that don't support transparency if original had it
    if (formatSelect.value === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
    }
    
    ctx.drawImage(currentImage, 0, 0, w, h);
  }

  // Event Listeners for inputs
  widthInput.addEventListener('input', () => {
    if (lockRatio.checked && widthInput.value) {
      heightInput.value = Math.round(widthInput.value / originalRatio);
    }
    updateCanvas();
  });

  heightInput.addEventListener('input', () => {
    if (lockRatio.checked && heightInput.value) {
      widthInput.value = Math.round(heightInput.value * originalRatio);
    }
    updateCanvas();
  });

  formatSelect.addEventListener('change', () => {
    updateQualityVisibility();
    updateCanvas(); // Just to re-apply jpeg background if needed
  });

  qualityInput.addEventListener('input', () => {
    qualityVal.textContent = Math.round(qualityInput.value * 100);
  });

  btnReset.addEventListener('click', () => {
    currentImage = null;
    originalFile = null;
    fileInput.value = '';
    SharedCore.show(dropzone);
    SharedCore.hide(workspace);
  });

  btnDownload.addEventListener('click', () => {
    if (!currentImage) return;
    
    let format = formatSelect.value;
    let quality = parseFloat(qualityInput.value);
    
    if (format === 'image/png') quality = undefined;
    
    canvas.toBlob((blob) => {
      const ext = ImageUtils.getExtension(format);
      const name = originalFile.name.replace(/\.[^/.]+$/, "") + '-resized.' + ext;
      SharedCore.downloadBlob(blob, name);
    }, format, quality);
  });

  btnCopy.addEventListener('click', () => {
    if (!currentImage) return;

    // Clipboard API currently primarily supports image/png.
    // If the user picked JPEG or WebP, we'll still copy it as PNG for clipboard compatibility,
    // but the canvas already has the background applied if JPEG was selected in formatSelect.
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        const originalText = btnCopy.textContent;
        btnCopy.textContent = 'Copied!';
        setTimeout(() => {
          btnCopy.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy image to clipboard:', err);
        alert('Failed to copy image to clipboard');
      }
    }, 'image/png');
  });
});