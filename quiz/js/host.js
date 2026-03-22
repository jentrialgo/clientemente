// quiz/js/host.js

let hostPeer = null;
let hostPin = null;
let connectedPlayers = {}; // id -> { connection, name, score }
let currentQuiz = null;
let currentQuestionIndex = 0;
let currentQuestionTimer = null;
let currentQuestionTimeLeft = 0;
let answeredPlayersThisRound = new Set();
let isAcceptingAnswers = false;

// Generate random alphanumeric PIN
function generatePIN(length = 5) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // removed ambiguous chars
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ---------------- SETUP & LOAD QUIZ ----------------
const quizFileInput = document.getElementById('quiz-file-input');
const dropzone = document.getElementById('quiz-dropzone');
const hostStartLobbyBtn = document.getElementById('host-start-lobby-btn');

quizFileInput.addEventListener('change', handleFileSelect);

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        quizFileInput.files = e.dataTransfer.files;
        handleFileSelect(e);
    }
});

function handleFileSelect(e) {
    const file = e.target.files ? e.target.files[0] : (e.dataTransfer ? e.dataTransfer.files[0] : null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            if (file.name.endsWith('.json')) {
                currentQuiz = JSON.parse(event.target.result);
                // Basic validation
                if (!Array.isArray(currentQuiz)) throw new Error('Root must be an array');
                setupQuizPreview(file.name, currentQuiz.length);
            } else if (file.name.endsWith('.csv')) {
                // simple csv parser
                currentQuiz = parseCSV(event.target.result);
                setupQuizPreview(file.name, currentQuiz.length);
            } else {
                alert('Unsupported file format. Use .json or .csv');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to parse quiz file. ' + err.message);
        }
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV is empty or missing header');
    const questions = [];
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Expecting: question, option1, option2, ..., correctIndex, time
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        const questionText = parts[0];
        const options = [];
        let j = 1;
        while(j < parts.length - 2 && parts[j]) {
            options.push(parts[j]);
            j++;
        }
        const correctIndex = parseInt(parts[parts.length - 2], 10);
        const time = parseInt(parts[parts.length - 1], 10) || 20;

        questions.push({
            question: questionText,
            options: options,
            correctIndex: correctIndex,
            time: time
        });
    }
    return questions;
}

function setupQuizPreview(name, count) {
    document.getElementById('quiz-dropzone').classList.add('hidden');
    document.getElementById('quiz-preview').classList.remove('hidden');
    document.getElementById('quiz-title-preview').textContent = name;
    document.getElementById('quiz-count').textContent = count;
}

// ---------------- LOBBY & WEBRTC ----------------

hostStartLobbyBtn.addEventListener('click', startLobby);

function startLobby() {
    hostPin = generatePIN();
    hostPeer = new Peer('clientemente-quiz-' + hostPin);

    hostPeer.on('open', (id) => {
        SharedCore.navigate('host-lobby');
        document.getElementById('lobby-pin').textContent = hostPin;
        
        // Generate QR code
        const joinUrl = `${window.location.origin}${window.location.pathname}?pin=${hostPin}`;
        document.getElementById('lobby-url').textContent = joinUrl;
        
        const qrContainer = document.getElementById('lobby-qr');
        qrContainer.innerHTML = ''; // clear prev
        new QRCode(qrContainer, {
            text: joinUrl,
            width: 250,
            height: 250,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    });

    hostPeer.on('connection', (conn) => {
        conn.on('data', (data) => {
            handleClientMessage(conn, data);
        });
        conn.on('close', () => {
            if (connectedPlayers[conn.peer]) {
                delete connectedPlayers[conn.peer];
                updateLobbyPlayers();
            }
        });
    });

    hostPeer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'unavailable-id') {
            // Pin collision, retry
            startLobby();
        }
    });
}

function handleClientMessage(conn, data) {
    if (data.type === 'join') {
        const nameExists = Object.values(connectedPlayers).some(p => p.name.toLowerCase() === data.name.toLowerCase());
        
        if (nameExists) {
            conn.send({ type: 'joined', success: false, reason: 'Name is already taken.' });
            return;
        }

        connectedPlayers[conn.peer] = {
            connection: conn,
            name: data.name,
            score: 0,
            answers: []
        };
        updateLobbyPlayers();
        conn.send({ type: 'joined', success: true });
    } else if (data.type === 'answer' && isAcceptingAnswers) {
        if (!answeredPlayersThisRound.has(conn.peer)) {
            answeredPlayersThisRound.add(conn.peer);
            
            const q = currentQuiz[currentQuestionIndex];
            const timeTaken = q.time - currentQuestionTimeLeft;
            const isCorrect = data.choice === q.correctIndex;
            let points = 0;

            if (isCorrect) {
                // Score calculation: max 1000, min 500 based on time
                const timeRatio = currentQuestionTimeLeft / q.time;
                points = Math.round(500 + (500 * timeRatio));
                connectedPlayers[conn.peer].score += points;
            }

            connectedPlayers[conn.peer].answers.push({
                questionIndex: currentQuestionIndex,
                choice: data.choice,
                isCorrect: isCorrect,
                timeTaken: timeTaken,
                points: points
            });
            document.getElementById('current-answers').textContent = answeredPlayersThisRound.size;
            
            if (answeredPlayersThisRound.size >= Object.keys(connectedPlayers).length) {
                endQuestion();
            }
        }
    }
}

function updateLobbyPlayers() {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    const players = Object.values(connectedPlayers);
    document.getElementById('player-count').textContent = players.length;
    
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        list.appendChild(li);
    });

    const startBtn = document.getElementById('host-start-game-btn');
    startBtn.disabled = players.length === 0;
}

// ---------------- GAME LOOP ----------------

document.getElementById('host-start-game-btn').addEventListener('click', startGame);

function startGame() {
    currentQuestionIndex = 0;
    showQuestion();
}

function broadcast(msg) {
    Object.values(connectedPlayers).forEach(p => {
        p.connection.send(msg);
    });
}

function showQuestion() {
    SharedCore.navigate('host-game');
    const q = currentQuiz[currentQuestionIndex];
    answeredPlayersThisRound.clear();
    isAcceptingAnswers = true;
    currentQuestionTimeLeft = q.time || 20;

    document.getElementById('host-question-text').textContent = q.question;
    document.getElementById('current-answers').textContent = '0';
    document.getElementById('total-players').textContent = Object.keys(connectedPlayers).length;
    document.getElementById('host-timer').textContent = currentQuestionTimeLeft;
    document.getElementById('host-next-controls').classList.add('hidden');

    const optionsContainer = document.getElementById('host-options');
    optionsContainer.innerHTML = '';
    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = `option-card color-${idx}`;
        div.textContent = opt;
        optionsContainer.appendChild(div);
    });

    broadcast({ type: 'start_question', optionsCount: q.options.length, time: currentQuestionTimeLeft });

    clearInterval(currentQuestionTimer);
    currentQuestionTimer = setInterval(() => {
        currentQuestionTimeLeft--;
        document.getElementById('host-timer').textContent = currentQuestionTimeLeft;
        if (currentQuestionTimeLeft <= 0) {
            endQuestion();
        }
    }, 1000);
}

function endQuestion() {
    clearInterval(currentQuestionTimer);
    isAcceptingAnswers = false;

    const q = currentQuiz[currentQuestionIndex];
    const choiceCounts = new Array(q.options.length).fill(0);
    let totalAnswers = 0;

    Object.keys(connectedPlayers).forEach(peer => {
        if (!answeredPlayersThisRound.has(peer)) {
            connectedPlayers[peer].answers.push({
                questionIndex: currentQuestionIndex,
                choice: -1,
                isCorrect: false,
                timeTaken: q.time,
                points: 0
            });
        }
        
        // Tally answers
        const playerAnswers = connectedPlayers[peer].answers;
        const lastAnswer = playerAnswers[playerAnswers.length - 1];
        if (lastAnswer && lastAnswer.choice !== -1) {
            choiceCounts[lastAnswer.choice]++;
            totalAnswers++;
        }
    });

    const options = document.getElementById('host-options').children;
    for (let i = 0; i < options.length; i++) {
        if (i === q.correctIndex) {
            options[i].classList.add('correct');
        } else {
            options[i].classList.add('incorrect');
        }

        const pct = totalAnswers > 0 ? Math.round((choiceCounts[i] / totalAnswers) * 100) : 0;
        
        const statsDiv = document.createElement('div');
        statsDiv.className = 'result-stats';
        statsDiv.style.marginTop = '15px';
        statsDiv.innerHTML = `
            <div style="width: 100%; height: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: #ffffff; transition: width 0.5s ease-out;"></div>
            </div>
            <div style="text-align: right; font-size: 0.9em; margin-top: 5px; font-weight: bold;">
                ${pct}% (${choiceCounts[i]})
            </div>
        `;
        options[i].appendChild(statsDiv);
    }

    broadcast({ type: 'end_question', correctIndex: q.correctIndex });

    document.getElementById('host-next-controls').classList.remove('hidden');
}

document.getElementById('host-next-btn').addEventListener('click', () => {
    showScoreboard();
});

function showScoreboard() {
    SharedCore.navigate('host-scoreboard');
    const list = document.getElementById('scoreboard-list');
    list.innerHTML = '';
    
    const sorted = Object.values(connectedPlayers).sort((a, b) => b.score - a.score);
    sorted.slice(0, 5).forEach(p => {
        const row = document.createElement('div');
        row.className = 'score-row';
        row.innerHTML = `<span class="score-name">${p.name}</span> <span class="score-val">${p.score}</span>`;
        list.appendChild(row);
    });

    broadcast({ type: 'scoreboard', selfScores: Object.fromEntries(sorted.map(p => [p.connection.peer, p.score])) });
}

document.getElementById('host-next-scoreboard-btn').addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuiz.length) {
        showQuestion();
    } else {
        showFinalResults();
    }
});

function showFinalResults() {
    SharedCore.navigate('host-results');
    const podium = document.getElementById('final-podium');
    podium.innerHTML = '';
    
    const sorted = Object.values(connectedPlayers).sort((a, b) => b.score - a.score);
    sorted.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'score-row';
        row.innerHTML = `<strong>#${idx + 1}</strong> <span class="score-name">${p.name}</span> <span class="score-val">${p.score}</span>`;
        podium.appendChild(row);
    });

    broadcast({ type: 'quiz_end' });
}

document.getElementById('host-download-results-btn').addEventListener('click', () => {
    const sorted = Object.values(connectedPlayers).sort((a, b) => b.score - a.score);
    
    // Generate CSV Headers
    let csv = "Rank,Player,Total Score";
    const numQuestions = currentQuiz.length;
    for (let i = 0; i < numQuestions; i++) {
        csv += `,Q${i + 1} Answer,Q${i + 1} Correct,Q${i + 1} Time(s),Q${i + 1} Points`;
    }
    csv += "\n";
    
    // Generate Rows
    sorted.forEach((p, idx) => {
        csv += `${idx + 1},"${p.name.replace(/"/g, '""')}",${p.score}`;
        
        // Ensure answers are sorted by question index just in case
        let pAnswers = p.answers ? [...p.answers].sort((a, b) => a.questionIndex - b.questionIndex) : [];
        
        for (let i = 0; i < numQuestions; i++) {
            const ans = pAnswers.find(a => a.questionIndex === i);
            if (ans) {
                let answerText = ans.choice === -1 ? 'None' : String.fromCharCode(65 + ans.choice);
                // Try to get the actual text if available
                if (ans.choice !== -1 && currentQuiz[i] && currentQuiz[i].options[ans.choice]) {
                    answerText = currentQuiz[i].options[ans.choice].replace(/"/g, '""');
                }
                csv += `,"${answerText}",${ans.isCorrect ? 'Yes' : 'No'},${ans.timeTaken.toFixed(1)},${ans.points}`;
            } else {
                csv += `,"None",No,0,0`;
            }
        }
        csv += "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_results_${hostPin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

// ---------------- CLEANUP ----------------

document.querySelectorAll('[data-nav="home"]').forEach(btn => {
    btn.addEventListener('click', resetHostState);
});

function resetHostState() {
    if (hostPeer) {
        broadcast({ type: 'host_left' });
        setTimeout(() => {
            if (hostPeer) {
                hostPeer.destroy();
                hostPeer = null;
            }
        }, 500); // Give it a moment to send the message
    }
    
    connectedPlayers = {};
    hostPin = null;
    currentQuiz = null;
    currentQuestionIndex = 0;
    currentQuestionTimeLeft = 0;
    answeredPlayersThisRound = new Set();
    isAcceptingAnswers = false;
    
    // reset UI
    document.getElementById('quiz-dropzone').classList.remove('hidden');
    document.getElementById('quiz-preview').classList.add('hidden');
    if (quizFileInput) quizFileInput.value = '';
    
    updateLobbyPlayers();
}
