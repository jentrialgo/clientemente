// Initialize App and Views
document.addEventListener('DOMContentLoaded', () => {
    SharedCore.initRouter({
        toolCards: null, // we don't have tool cards here
        backBtns: document.querySelectorAll('.back-btn'),
        logoLink: document.getElementById('logo-link')
    });
    
    // Check if we have a PIN in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const pin = urlParams.get('pin');
    
    if (pin) {
        // Auto-navigate to join view and fill PIN
        SharedCore.navigate('join');
        const pinInput = document.getElementById('join-pin');
        if (pinInput) {
            pinInput.value = pin.toUpperCase();
        }
    }
    
    // Add custom navigation buttons mapping
    document.querySelectorAll('[data-nav]').forEach(btn => {
        if (!btn.classList.contains('back-btn')) { // skipped above
            btn.addEventListener('click', () => SharedCore.navigate(btn.dataset.nav));
        }
    });
});
