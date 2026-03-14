document.addEventListener('DOMContentLoaded', () => {
  // Init Theme
  SharedCore.initTheme(document.getElementById('theme-toggle'));

  // Init Router
  SharedCore.initRouter({
    toolCards: document.querySelectorAll('.tool-card'),
    backBtns: document.querySelectorAll('.back-btn'),
    logoLink: document.getElementById('logo-link')
  });

  // Export common image util to easily load an image from a File
  window.ImageUtils = {
    loadImage(file) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = url;
      });
    },
    // Fix extension for download
    getExtension(mimeType) {
      switch (mimeType) {
        case 'image/jpeg': return 'jpg';
        case 'image/png': return 'png';
        case 'image/webp': return 'webp';
        default: return 'png';
      }
    }
  };
});