document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('crop-dropzone');
  const fileInput = document.getElementById('crop-file');
  const workspace = document.getElementById('crop-workspace');
  
  const canvas = document.getElementById('crop-canvas');
  const ctx = canvas.getContext('2d');
  
  const btnReset = document.getElementById('crop-reset');
  const btnCopy = document.getElementById('crop-copy');
  const btnDownload = document.getElementById('crop-download');
  
  const btnRotL = document.getElementById('crop-rotate-left');
  const btnRotR = document.getElementById('crop-rotate-right');
  const btnFlipH = document.getElementById('crop-flip-h');
  const btnFlipV = document.getElementById('crop-flip-v');

  let currentImage = null;
  let originalFile = null;

  // View state
  let scale = 1;
  let rotation = 0; // degrees
  let flipH = 1;
  let flipV = 1;

  // Crop selection box
  let cropRect = null; // {x, y, w, h}
  let isDragging = false;
  let startX, startY;

  SharedCore.initDropZone(dropzone, fileInput, async (files) => {
    if (!files || !files[0]) return;
    originalFile = files[0];
    try {
      currentImage = await ImageUtils.loadImage(originalFile);
      resetState();
      
      SharedCore.hide(dropzone);
      SharedCore.show(workspace);
    } catch (e) {
      alert('Could not load image');
    }
  }, { accept: 'image/*' });

  function resetState() {
    rotation = 0;
    flipH = 1;
    flipV = 1;
    cropRect = null;
    draw();
  }

  function getRenderSize() {
    let w = currentImage.width;
    let h = currentImage.height;
    if (rotation % 180 !== 0) {
      w = currentImage.height;
      h = currentImage.width;
    }
    
    // Scale for display if too big
    const maxW = window.innerWidth - 40;
    const maxH = window.innerHeight - 300;
    scale = Math.min(1, maxW / w, maxH / h);
    if (scale < 0.1) scale = 0.1;

    return {
      rw: w * scale,
      rh: h * scale,
      w, h
    };
  }

  function draw() {
    if (!currentImage) return;
    const size = getRenderSize();
    
    canvas.width = size.rw;
    canvas.height = size.rh;
    
    ctx.save();
    // Center origin
    ctx.translate(size.rw/2, size.rh/2);
    ctx.scale(scale, scale);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.scale(flipH, flipV);
    
    ctx.drawImage(currentImage, -currentImage.width/2, -currentImage.height/2);
    ctx.restore();

    // Draw crop rect if any
    if (cropRect) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      
      // Top
      ctx.fillRect(0, 0, canvas.width, cropRect.y);
      // Bottom
      ctx.fillRect(0, cropRect.y + cropRect.h, canvas.width, canvas.height - (cropRect.y + cropRect.h));
      // Left
      ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.h);
      // Right
      ctx.fillRect(cropRect.x + cropRect.w, cropRect.y, canvas.width - (cropRect.x + cropRect.w), cropRect.h);
      
      // Outline
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2;
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    }
  }

  // Mouse / Touch events for cropping
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const evt = e.touches ? e.touches[0] : e;
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  }

  canvas.addEventListener('mousedown', startCrop);
  canvas.addEventListener('touchstart', startCrop, {passive: false});
  
  window.addEventListener('mousemove', dragCrop);
  window.addEventListener('touchmove', dragCrop, {passive: false});

  window.addEventListener('mouseup', endCrop);
  window.addEventListener('touchend', endCrop);

  function startCrop(e) {
    if (!currentImage) return;
    if (e.touches) e.preventDefault();
    isDragging = true;
    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;
    cropRect = { x: startX, y: startY, w: 0, h: 0 };
    draw();
  }

  function dragCrop(e) {
    if (!isDragging || !cropRect) return;
    if (e.touches) e.preventDefault();
    const pos = getPos(e);
    
    // allow drawing backwards
    cropRect.x = Math.min(startX, pos.x);
    cropRect.y = Math.min(startY, pos.y);
    cropRect.w = Math.abs(pos.x - startX);
    cropRect.h = Math.abs(pos.y - startY);
    
    // constrain
    cropRect.x = Math.max(0, cropRect.x);
    cropRect.y = Math.max(0, cropRect.y);
    if (cropRect.x + cropRect.w > canvas.width) cropRect.w = canvas.width - cropRect.x;
    if (cropRect.y + cropRect.h > canvas.height) cropRect.h = canvas.height - cropRect.y;

    draw();
  }

  function endCrop() {
    isDragging = false;
    if (cropRect && (cropRect.w < 10 || cropRect.h < 10)) {
      cropRect = null;
      draw();
    }
  }

  // Toolbar
  btnRotL.addEventListener('click', () => { rotation -= 90; cropRect = null; draw(); });
  btnRotR.addEventListener('click', () => { rotation += 90; cropRect = null; draw(); });
  btnFlipH.addEventListener('click', () => { flipH *= -1; cropRect = null; draw(); });
  btnFlipV.addEventListener('click', () => { flipV *= -1; cropRect = null; draw(); });

  btnReset.addEventListener('click', () => {
    currentImage = null;
    originalFile = null;
    fileInput.value = '';
    SharedCore.show(dropzone);
    SharedCore.hide(workspace);
  });

  function generateExportCanvas() {
    if (!currentImage) return null;

    const size = getRenderSize();
    
    // Calculate final size
    let finalW = size.w;
    let finalH = size.h;
    
    let cropDestX = 0, cropDestY = 0;
    
    if (cropRect) {
      finalW = cropRect.w / scale;
      finalH = cropRect.h / scale;
      cropDestX = cropRect.x / scale;
      cropDestY = cropRect.y / scale;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = finalW;
    tempCanvas.height = finalH;
    const tCtx = tempCanvas.getContext('2d');

    // Fill white bg for jpegs
    if (originalFile.type === 'image/jpeg') {
      tCtx.fillStyle = '#ffffff';
      tCtx.fillRect(0,0,finalW, finalH);
    }
    
    tCtx.save();
    // Move to center of full image representation
    tCtx.translate((size.w/2) - cropDestX, (size.h/2) - cropDestY);
    tCtx.rotate(rotation * Math.PI / 180);
    tCtx.scale(flipH, flipV);
    
    tCtx.drawImage(currentImage, -currentImage.width/2, -currentImage.height/2);
    tCtx.restore();

    return tempCanvas;
  }

  btnDownload.addEventListener('click', () => {
    const tempCanvas = generateExportCanvas();
    if (!tempCanvas) return;

    tempCanvas.toBlob((blob) => {
      const ext = ImageUtils.getExtension(originalFile.type);
      const name = originalFile.name.replace(/\.[^/.]+$/, "") + '-cropped.' + ext;
      SharedCore.downloadBlob(blob, name);
    }, originalFile.type, 0.9);
  });

  btnCopy.addEventListener('click', () => {
    const tempCanvas = generateExportCanvas();
    if (!tempCanvas) return;

    tempCanvas.toBlob(async (blob) => {
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