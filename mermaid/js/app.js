import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

function getAppTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? 'dark' : 'default';
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme toggle
    SharedCore.initTheme(document.getElementById('theme-toggle'));

    const inputArea = document.getElementById('mermaid-input');
    const outputArea = document.getElementById('mermaid-output');
    const errorMsg = document.getElementById('error-message');
    
    // UI controls
    const themeSelect = document.getElementById('theme-select');
    const bgColorInput = document.getElementById('bg-color');
    const nodeColorInput = document.getElementById('node-color');
    const lineColorInput = document.getElementById('line-color');

    // Sync initial select with mode
    themeSelect.value = getAppTheme();

    let debounceTimer;

    const getMermaidConfig = () => {
        const theme = themeSelect.value;
        const nodeColor = nodeColorInput.value;
        const lineColor = lineColorInput.value;
        
        let config = {
            startOnLoad: false,
            theme: theme,
        };

        if (theme === 'neutral') {
            config.theme = 'base';
            config.themeVariables = {
                primaryColor: '#ffffff',
                primaryTextColor: '#000000',
                primaryBorderColor: '#666666',
                lineColor: '#333333',
                secondaryColor: '#f4f4f4',
                tertiaryColor: '#e5e5e5'
            };
        } else if (nodeColor !== '#ececff' || lineColor !== '#333333') {
             // If colors are customized but not on neutral/base, force base theme to apply them
             config.theme = 'base';
             config.themeVariables = {
                primaryColor: nodeColor,
                lineColor: lineColor,
                primaryTextColor: theme === 'dark' ? '#fff' : '#000'
             };
        }

        return config;
    };

    const renderMermaid = async () => {
        const code = inputArea.value.trim();
        const theme = themeSelect.value;
        
        // Update Canvas background
        outputArea.style.backgroundColor = theme === 'neutral' ? '#ffffff' : bgColorInput.value;

        if (!code) {
           outputArea.innerHTML = '';
           errorMsg.classList.remove('show');
           return;
        }

        try {
            mermaid.initialize(getMermaidConfig());
            const { svg } = await mermaid.render('mermaid-svg-diagram', code);
            outputArea.innerHTML = svg;
            errorMsg.classList.remove('show');
            errorMsg.innerText = '';
        } catch (error) {
            // Keep previous render intact, just show error
            errorMsg.classList.add('show');
            errorMsg.innerText = error.message || error.str || 'Syntax Error';
            
            // Mermaid appends an error SVG, let's remove it so it doesn't clutter the page unexpectedly
            const errorSvg = document.getElementById('mermaid-svg-diagram');
            if(errorSvg && errorSvg.parentElement !== outputArea){
                errorSvg.remove();
            }
        }
    };

    const triggerRender = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(renderMermaid, 500);
    };

    inputArea.addEventListener('input', triggerRender);
    themeSelect.addEventListener('change', renderMermaid);
    bgColorInput.addEventListener('input', () => { outputArea.style.backgroundColor = bgColorInput.value; });
    nodeColorInput.addEventListener('change', renderMermaid);
    lineColorInput.addEventListener('change', renderMermaid);

    // Theme toggle interaction handling (depends on core.js logic)
    const observer = new MutationObserver(() => {
        if(themeSelect.value === 'default' || themeSelect.value === 'dark') {
            themeSelect.value = getAppTheme();
            renderMermaid();
        }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Download handlers
    document.getElementById('download-svg').addEventListener('click', () => {
        const svgElement = outputArea.querySelector('svg');
        if (!svgElement) return;

        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svgElement);
        
        // Add name spaces
        if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
            source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        if(!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
            source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
        }

        // Add xml declaration
        const blob = new Blob(["<?xml version=\"1.0\" standalone=\"no\"?>\r\n", source], {type: "image/svg+xml;charset=utf-8"});
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = url;
        link.download = "mermaid-diagram.svg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById('download-png').addEventListener('click', () => {
      const svgElement = outputArea.querySelector('svg');
      if (!svgElement) return;

      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgElement);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          // Fill background if needed
          const theme = themeSelect.value;
          ctx.fillStyle = theme === 'neutral' ? '#ffffff' : (bgColorInput.value || (getAppTheme() === 'dark' ? '#141414' : '#ffffff'));
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          const url = canvas.toDataURL('image/png');
          const link = document.createElement("a");
          link.href = url;
          link.download = "mermaid-diagram.png";
          link.click();
      };
      
      const DOMURL = window.URL || window.webkitURL || window;
      const svgBlob = new Blob([source], {type: 'image/svg+xml;charset=utf-8'});
      img.src = DOMURL.createObjectURL(svgBlob);
    });

    // Copy Code handler
    document.getElementById('copy-code').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(inputArea.value);
        const btn = document.getElementById('copy-code');
        const origText = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => btn.innerText = origText, 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    });

    // Download .mmd handler
    document.getElementById('download-mmd').addEventListener('click', () => {
      const blob = new Blob([inputArea.value], {type: "text/plain;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "diagram.mmd";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    // Copy SVG handler
    document.getElementById('copy-svg').addEventListener('click', async () => {
      const svgElement = outputArea.querySelector('svg');
      if (!svgElement) return;

      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgElement);

      try {
        await navigator.clipboard.writeText(source);
        const btn = document.getElementById('copy-svg');
        const origText = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => btn.innerText = origText, 2000);
      } catch (err) {
        console.error('Failed to copy SVG: ', err);
      }
    });

    // Initial render
    renderMermaid();
});
