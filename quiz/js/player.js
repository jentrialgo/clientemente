// quiz/js/player.js

let playerPeer = null;
let hostConn = null;
let playerName = '';
let myScore = 0;

document.getElementById('join-btn').addEventListener('click', joinGame);

function joinGame() {
    const pin = document.getElementById('join-pin').value.trim().toUpperCase();
    const name = document.getElementById('join-name').value.trim();
    const errorEl = document.getElementById('join-error');

    if (!pin || !name) {
        errorEl.textContent = "PIN and Nickname are required.";
        errorEl.classList.remove('hidden');
        return;
    }
    
    errorEl.classList.add('hidden');
    playerName = name;
    
    // Initialize peer
    playerPeer = new Peer(); // random id
    SharedCore.navigate('player-game');
    setPlayerStatus('Connecting to host...');

    playerPeer.on('open', (id) => {
        // connect to host
        hostConn = playerPeer.connect('clientemente-quiz-' + pin, { reliable: true });
        
        hostConn.on('open', () => {
            hostConn.send({ type: 'join', name: playerName });
        });

        hostConn.on('data', (data) => {
            handleHostMessage(data);
        });

        hostConn.on('close', () => {
            setPlayerStatus('Disconnected from host.');
            document.getElementById('player-answers').classList.add('hidden');
        });
        
        hostConn.on('error', (err) => {
            setPlayerStatus('Connection error.');
            console.error(err);
        });
    });

    playerPeer.on('error', (err) => {
        console.error(err);
        setPlayerStatus('Failed to connect to signal server.');
    });
}

function handleHostMessage(data) {
    if (data.type === 'joined') {
        if (data.success) {
            setPlayerStatus(`You're in! Waiting for host to start...`);
        } else {
            SharedCore.navigate('join');
            const errorEl = document.getElementById('join-error');
            errorEl.textContent = data.reason || 'Join failed';
            errorEl.classList.remove('hidden');
            if (hostConn) {
                hostConn.close();
                hostConn = null;
            }
        }
    } else if (data.type === 'start_question') {
        renderAnswerButtons(data.optionsCount, data.questionType || 'single');
    } else if (data.type === 'end_question') {
        setPlayerStatus('Question ended.');
        document.getElementById('player-answers').classList.add('hidden');
        // We could show correct/wrong here if we tracked it locally or if host sent it
    } else if (data.type === 'scoreboard') {
        // update local score
        if (data.selfScores && data.selfScores[playerPeer.id] !== undefined) {
            myScore = data.selfScores[playerPeer.id];
        }
        setPlayerStatus(`Score: ${myScore}\nWaiting for next question...`);
        document.getElementById('player-answers').classList.add('hidden');
    } else if (data.type === 'quiz_end') {
        setPlayerStatus(`Quiz Finished!\nYour final score: ${myScore}`);
        document.getElementById('player-answers').classList.add('hidden');
    } else if (data.type === 'host_left') {
        setPlayerStatus(`Host has ended the game and closed the lobby.`);
        document.getElementById('player-answers').classList.add('hidden');
        if (hostConn) {
            hostConn.close();
            hostConn = null;
        }
    }
}

function setPlayerStatus(msg) {
    const statusText = document.getElementById('player-status-text');
    statusText.innerText = msg; // innerText to interpret newlines
    document.getElementById('player-status').classList.remove('hidden');
}

function renderAnswerButtons(count, questionType = 'single') {
    document.getElementById('player-status').classList.add('hidden');
    const answersContainer = document.getElementById('player-answers');
    answersContainer.innerHTML = '';
    answersContainer.classList.remove('hidden');

    let selectedChoices = [];

    for (let i = 0; i < count; i++) {
        const btn = document.createElement('button');
        btn.className = `player-btn color-${i}`;
        
        if (questionType === 'multiple') {
            btn.onclick = () => {
                const idx = selectedChoices.indexOf(i);
                if (idx > -1) {
                    selectedChoices.splice(idx, 1);
                    btn.classList.remove('selected');
                } else {
                    selectedChoices.push(i);
                    btn.classList.add('selected');
                }
            };
        } else {
            btn.onclick = () => sendAnswer(i, answersContainer.children, questionType);
        }
        
        answersContainer.appendChild(btn);
    }

    if (questionType === 'multiple') {
        const submitWrapper = document.createElement('div');
        submitWrapper.style.width = '100%';
        submitWrapper.style.marginTop = '1rem';
        submitWrapper.style.display = 'flex';
        submitWrapper.style.justifyContent = 'center';
        
        const submitBtn = document.createElement('button');
        submitBtn.textContent = 'Submit Answers';
        submitBtn.className = 'btn btn-primary';
        submitBtn.style.width = '100%';
        submitBtn.style.padding = '1.5rem';
        submitBtn.onclick = () => {
            if (selectedChoices.length === 0) {
                alert('Please select at least one answer.');
                return;
            }
            sendAnswer(selectedChoices, answersContainer.children, questionType);
        };
        submitWrapper.appendChild(submitBtn);
        answersContainer.appendChild(submitWrapper);
    }
}

function sendAnswer(choiceOrChoices, allElements, questionType = 'single') {
    // Disable all buttons
    for (let el of allElements) {
        if (el.tagName.toLowerCase() === 'button') {
            el.classList.add('disabled');
        } else if (el.children) {
            for (let child of el.children) {
                if (child.tagName && child.tagName.toLowerCase() === 'button') {
                    child.classList.add('disabled');
                }
            }
        }
    }
    
    // Show 'Answer sent' locally
    if (questionType === 'multiple') {
        hostConn.send({ type: 'answer', choices: choiceOrChoices });
    } else {
        hostConn.send({ type: 'answer', choice: choiceOrChoices });
    }
    setPlayerStatus('Answer sent! Waiting for others...');
    document.getElementById('player-answers').classList.add('hidden');
}
