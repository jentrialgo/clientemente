// quiz/js/builder.js
let builderData = [];

document.addEventListener('DOMContentLoaded', () => {
    const builderAddQBtn = document.getElementById('builder-add-q-btn');
    const builderSavePlayBtn = document.getElementById('builder-save-play-btn');
    const builderExportBtn = document.getElementById('builder-export-btn');
    
    if (builderAddQBtn) builderAddQBtn.addEventListener('click', addBuilderQuestion);
    if (builderSavePlayBtn) builderSavePlayBtn.addEventListener('click', startBuiltQuiz);
    if (builderExportBtn) builderExportBtn.addEventListener('click', exportBuiltQuiz);

    // Initialize with one question if empty and user navigates to builder
    const builderNavBtn = document.querySelector('[data-nav="host-builder"]');
    if (builderNavBtn) {
        builderNavBtn.addEventListener('click', () => {
            if (builderData.length === 0) {
                addBuilderQuestion();
            }
        });
    }
});

function addBuilderQuestion() {
    builderData.push({
        id: Date.now().toString(),
        question: '',
        options: ['', '', '', ''], // Default 4 options
        correctIndex: 0,
        time: 20
    });
    renderBuilder();
}

function removeBuilderQuestion(id) {
    builderData = builderData.filter(q => q.id !== id);
    renderBuilder();
}

function updateQuestionField(id, field, value) {
    const q = builderData.find(q => q.id === id);
    if (q) q[field] = value;
}

function updateOption(qId, optIndex, value) {
    const q = builderData.find(q => q.id === qId);
    if (q) q.options[optIndex] = value;
}

function addOption(qId) {
    const q = builderData.find(q => q.id === qId);
    if (q && q.options.length < 6) {
        q.options.push('');
        renderBuilder();
    }
}

function removeOption(qId, optIndex) {
    const q = builderData.find(q => q.id === qId);
    if (q && q.options.length > 2) {
        q.options.splice(optIndex, 1);
        if (q.correctIndex >= q.options.length) {
            q.correctIndex = 0; // reset to 0 if we removed the correct answer
        } else if (q.correctIndex === optIndex) {
            q.correctIndex = 0;
        } else if (q.correctIndex > optIndex) {
            q.correctIndex--;
        }
        renderBuilder();
    }
}

function renderBuilder() {
    const list = document.getElementById('builder-questions-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    builderData.forEach((q, qIndex) => {
        const div = document.createElement('div');
        div.className = 'builder-q-card';
        
        // Options HTML
        let optionsHtml = '';
        q.options.forEach((opt, optIndex) => {
            optionsHtml += `
                <div class="builder-option-row">
                    <input type="radio" name="correct-${q.id}" ${q.correctIndex === optIndex ? 'checked' : ''} onchange="updateQuestionField('${q.id}', 'correctIndex', ${optIndex})">
                    <input type="text" class="input" placeholder="Option ${optIndex + 1}" value="${opt.replace(/"/g, '&quot;')}" oninput="updateOption('${q.id}', ${optIndex}, this.value)">
                    <button type="button" title="Remove Option" onclick="removeOption('${q.id}', ${optIndex})" ${q.options.length <= 2 ? 'disabled style="opacity:0.2;"' : ''}>✕</button>
                </div>
            `;
        });
        
        div.innerHTML = `
            <div class="builder-q-header">
                <h3>Q${qIndex + 1}.</h3>
                <input type="text" class="input" placeholder="Question text..." value="${q.question.replace(/"/g, '&quot;')}" oninput="updateQuestionField('${q.id}', 'question', this.value)">
                <button type="button" class="builder-q-delete" onclick="removeBuilderQuestion('${q.id}')">&times;</button>
            </div>
            
            <div class="builder-q-meta">
                <label>
                    Time (sec):
                    <input type="number" class="input" style="width: 70px;" value="${q.time}" min="5" max="300" oninput="updateQuestionField('${q.id}', 'time', parseInt(this.value) || 20)">
                </label>
            </div>
            
            <div class="builder-options">
                ${optionsHtml}
            </div>
            ${q.options.length < 6 ? `<button class="builder-add-option-btn" onclick="addOption('${q.id}')">+ Add Option</button>` : ''}
        `;
        list.appendChild(div);
    });
}

function getValidatedQuiz() {
    if (builderData.length === 0) {
        alert("Add at least one question.");
        return null;
    }
    
    // Check for empty questions or options
    for (let i = 0; i < builderData.length; i++) {
        const q = builderData[i];
        if (!q.question.trim()) {
            alert(`Question ${i + 1} is missing text.`);
            return null;
        }
        for (let j = 0; j < q.options.length; j++) {
            if (!q.options[j].trim()) {
                alert(`Option ${j + 1} in Question ${i + 1} is empty.`);
                return null;
            }
        }
    }
    
    // Map to remove IDs used for builder tracking
    return builderData.map(q => ({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        time: q.time
    }));
}

function startBuiltQuiz() {
    const validated = getValidatedQuiz();
    if (validated) {
        // defined in host.js
        currentQuiz = validated;
        const title = document.getElementById('builder-quiz-title').value || 'Custom Quiz';
        
        // Skip preview and directly create lobby
        startLobby(); // this is the fn inside host.js
    }
}

function exportBuiltQuiz() {
    const validated = getValidatedQuiz();
    if (validated) {
        const title = document.getElementById('builder-quiz-title').value || 'Custom_Quiz';
        const blob = new Blob([JSON.stringify(validated, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
