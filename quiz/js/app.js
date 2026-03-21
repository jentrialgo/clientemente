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

    const testQuizBtn = document.getElementById('play-test-quiz-btn');
    if (testQuizBtn) {
        testQuizBtn.addEventListener('click', () => {
            currentQuiz = [
                {
                    question: "Is a hot dog a sandwich?",
                    options: ["Yes", "No"],
                    correctIndex: 1,
                    time: 20
                },
                {
                    question: "What's the best strategy in a zombie apocalypse?",
                    options: ["Run away", "Find weapons", "Befriend them"],
                    correctIndex: 0,
                    time: 20
                },
                {
                    question: "Which superpower is the most annoying?",
                    options: ["Mind reading", "Invisibility", "Super speed", "Talking to fish"],
                    correctIndex: 3,
                    time: 20
                },
                {
                    question: "If animals could talk, which one would constantly complain?",
                    options: ["Cat", "Pug", "Sloth", "Seagull", "Pigeon"],
                    correctIndex: 0,
                    time: 20
                }
            ];
            
            // startLobby is defined in host.js and globally accessible
            if (typeof startLobby === 'function') {
                startLobby();
            } else {
                console.error("startLobby function not found");
            }
        });
    }
});
