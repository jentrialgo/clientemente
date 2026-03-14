document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById('profile-dropzone');
  const fileInput = document.getElementById('profile-file');
  const workspace = document.getElementById('profile-workspace');
  
  const canvas = document.getElementById('profile-canvas');
  const ctx = canvas.getContext('2d');
  const container = document.querySelector('.profile-container');
  
  const scaleInput = document.getElementById('profile-scale');
  const btnReset = document.getElementById('profile-reset');
  const btnDownload = document.getElementById('profile-download');

  let currentImage = null;
  let originalFile = null;
  
  // State
  let posX = 0, posY = 0;
  let scale = 1;
  let baseScale = 1;
  const VIEW_SIZE = 400; // HTML container size
  const EXPORT_SIZE = 500; // Output image size

  // Dragging
  let isDragging = false;
  let lastX, lastY;

  SharedCore.initDropZone(dropzone, fileInput, async (files) => {
    if (!files || !files[0]) return;
    originalFile = files[0];
    
    try {
      currentImage = await ImageUtils.loadImage(originalFile);
      
      // Calculate base scale to cover the VIEW_SIZE
      const scaleX = VIEW_SIZE / currentImage.width;
      const scaleY = VIEW_SIZE / currentImage.height;
      baseScale = Math.max(scaleX, scaleY);
      
      scale = 1;
      scaleInput.value = 1;
      
      // Center image
      const scaledW = currentImage.width * baseScale;
      const scaledH = currentImage.height * baseScale;
      posX = (VIEW_SIZE - scaledW) / 2;
      posY = (VIEW_SIZE - scaledH) / 2;

      canvas.width = VIEW_SIZE;
      canvas.height = VIEW_SIZE;

      draw();
      
      SharedCore.hide(dropzone);
      SharedCore.show(workspace);
    } catch (e) {
      alert('Could not load image');
    }
  }, { accept: 'image/*' });

  function draw() {
    if (!currentImage) return;
    
    // Clear
    ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE);
    
    const finalScale = baseScale * scale;
    const w = currentImage.width * finalScale;
    const h = currentImage.height * finalScale;

    ctx.drawImage(currentImage, posX, posY, w, h);
  }

  // Pan interaction
  function getPos(e) {
    const evt = e.touches ? e.touches[0] : e;
    return { x: evt.clientX, y: evt.clientY };
  }

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    const p = getPos(e);
    lastX = p.x;
    lastY = p.y;
  });
  container.addEventListener('touchstart', (e) => {
    isDragging = true;
    if(e.touches.length === 1) {
      e.preventDefault();
      const p = getPos(e);
      lastX = p.x;
      lastY = p.y;
    }
  }, {passive: false});

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const p = getPos(e);
    posX += (p.x - lastX);
    posY += (p.y - lastY);
    lastX = p.x;
    lastY = p.y;
    draw();
  });
  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    if(e.touches.length === 1) {
      e.preventDefault();
      const p = getPos(e);
      posX += (p.x - lastX);
      posY += (p.y - lastY);
      lastX = p.x;
      lastY = p.y;
      draw();
    }
  }, {passive: false});

  window.addEventListener('mouseup', () => isDragging = false);
  window.addEventListener('touchend', () => isDragging = false);

  scaleInput.addEventListener('input', () => {
    // Keep focus roughly centered
    const oldScale = scale;
    scale = parseFloat(scaleInput.value);
    
    const center = VIEW_SIZE / 2;
    const scaleDiff = scale / oldScale;
    
    posX = center - (center - posX) * scaleDiff;
    posY = center - (center - posY) * scaleDiff;
    
    draw();
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

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = EXPORT_SIZE;
    tempCanvas.height = EXPORT_SIZE;
    const tCtx = tempCanvas.getContext('2d');

    const mult = EXPORT_SIZE / VIEW_SIZE;
    
    // Draw image
    const finalScale = baseScale * scale * mult;
    const w = currentImage.width * finalScale;
    const h = currentImage.height * finalScale;
    
    tCtx.drawImage(currentImage, posX * mult, posY * mult, w, h);

    // Mask out the circle
    tCtx.globalCompositeOperation = 'destination-in';
    tCtx.beginPath();
    tCtx.arc(EXPORT_SIZE/2, EXPORT_SIZE/2, EXPORT_SIZE/2, 0, Math.PI * 2);
    tCtx.fill();
    
    // Reset composite operation just in case
    tCtx.globalCompositeOperation = 'source-over';

    tempCanvas.toBlob((blob) => {
      const name = originalFile.name.replace(/\.[^/.]+$/, "") + '-profile.png';
      SharedCore.downloadBlob(blob, name);
    }, 'image/png');
  });
});