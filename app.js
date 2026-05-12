const WORD_LENGTH = 5;
const MAX_GUESSES = 5; 
const ANIMATION_DELAY_MS = 150;
const SHAKE_DELAY_MS = 300;

const SVG_MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
const SVG_SUN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

// --- NEW FLIP ICON ---
const SVG_SPIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;

function getEl(id) { return document.getElementById(id); }

function announce(message) {
    const announcer = getEl('sr-announcer');
    if(announcer) {
        announcer.textContent = ''; 
        setTimeout(() => { announcer.textContent = message; }, 50);
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('flippingLettersTheme') || 'light';
    const themeBtn = getEl('themeBtn');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if(themeBtn) themeBtn.innerHTML = SVG_SUN;
    } else {
        document.body.classList.remove('dark-theme');
        if(themeBtn) themeBtn.innerHTML = SVG_MOON;
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('flippingLettersTheme', isDark ? 'dark' : 'light');
    getEl('themeBtn').innerHTML = isDark ? SVG_SUN : SVG_MOON;
}

const validWords = new Set();

async function loadLocalDictionary() {
    try {
        const res = await fetch('valid-words.json');
        if (res.ok) {
            const words = await res.json();
            words.forEach(w => validWords.add(w.toLowerCase()));
        }
    } catch (e) {
        console.warn("Full valid-words.json not found.");
    }
}

function mulberry32(a) {
    return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

const defaultStats = { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, distribution: Array(MAX_GUESSES).fill(0), lastCompletedDay: -1 };

function validateStats(stats) {
    if (!stats || typeof stats !== 'object') return false;
    if (typeof stats.played !== 'number' || stats.played < 0) return false;
    if (typeof stats.wins !== 'number' || stats.wins < 0 || stats.wins > stats.played) return false;
    if (typeof stats.currentStreak !== 'number' || stats.currentStreak < 0) return false;
    if (typeof stats.maxStreak !== 'number' || stats.maxStreak < 0) return false;
    if (!Array.isArray(stats.distribution) || stats.distribution.length !== MAX_GUESSES) return false;
    if (!stats.distribution.every(n => typeof n === 'number' && n >= 0)) return false;
    if (typeof stats.lastCompletedDay !== 'number') return false;
    return true;
}

let userStats;
try {
    let stored = localStorage.getItem('flippingLettersStats');
    let parsed = stored ? JSON.parse(stored) : null;
    if (validateStats(parsed)) {
        userStats = parsed;
    } else {
        userStats = JSON.parse(JSON.stringify(defaultStats));
    }
} catch(e) {
    userStats = JSON.parse(JSON.stringify(defaultStats));
}

function saveStats() { localStorage.setItem('flippingLettersStats', JSON.stringify(userStats)); }

function updateStats(won) {
    if (userStats.lastCompletedDay === state.puzzleNumber) return;
    userStats.played++;
    if (won) {
        userStats.wins++;
        userStats.currentStreak++;
        if (userStats.currentStreak > userStats.maxStreak) userStats.maxStreak = userStats.currentStreak;
        userStats.distribution[state.currentRow]++;
    } else { userStats.currentStreak = 0; }
    userStats.lastCompletedDay = state.puzzleNumber;
    saveStats();
}

function renderStatsModal() {
    if(!getEl('statPlayed')) return;
    getEl('statPlayed').innerText = userStats.played;
    getEl('statWinPct').innerText = userStats.played > 0 ? Math.round((userStats.wins / userStats.played) * 100) : 0;
    getEl('statStreak').innerText = userStats.currentStreak;
    getEl('statMax').innerText = userStats.maxStreak;

    const chartContainer = getEl('distChart');
    if (!chartContainer) return;
    chartContainer.innerHTML = ''; 

    const maxDist = Math.max(...userStats.distribution, 1); 
    
    userStats.distribution.forEach((count, index) => {
        const widthPct = Math.max((count / maxDist) * 100, 8); 
        const isCurrent = state.status === "WON" && state.currentRow === index;

        const row = document.createElement('div');
        row.className = 'dist-row';
        row.setAttribute('aria-label', `${count} wins on guess ${index + 1}`);

        const label = document.createElement('div');
        label.className = 'dist-label';
        label.setAttribute('aria-hidden', 'true');
        label.innerText = index + 1;

        const bar = document.createElement('div');
        bar.className = 'dist-bar';
        if (isCurrent) bar.classList.add('highlight');
        bar.style.width = `${widthPct}%`;
        bar.setAttribute('aria-hidden', 'true');
        bar.innerText = count;

        row.appendChild(label);
        row.appendChild(bar);
        chartContainer.appendChild(row);
    });
}

const state = {
    puzzleNumber: 1, targetWord: "", status: "PLAYING", currentRow: 0,
    board: Array.from({length: MAX_GUESSES}, () => []), bank: [] 
};

function initGame(overrideDateStr = null) {
    const now = new Date();
    let targetDateStr = overrideDateStr;
    
    if(!targetDateStr) {
        const yyyy = now.getUTCFullYear();
        const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(now.getUTCDate()).padStart(2, '0');
        targetDateStr = `${yyyy}-${mm}-${dd}`;
    }

    if(getEl('datePicker')) getEl('datePicker').value = targetDateStr;

    if (typeof puzzleDatabase === 'undefined') {
        showMessage("Error: levels.js is missing!");
        return;
    }

    const encryptedString = puzzleDatabase[targetDateStr];
    
    if (!encryptedString) {
        showMessage("No puzzle found for " + targetDateStr);
        return;
    }

    const dec = s => s.replace(/[a-z]/gi, c => String.fromCharCode((c <= 'Z' ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26));
    const decoded = dec(encryptedString);
    const [word, bankStr] = decoded.split('|');
    const rawBankItems = bankStr.split(',').map(pair => ({ char: pair[0], flipChar: pair[1] === '-' ? null : pair[1], isFlipped: false }));

    validWords.add(word); 

    const launchDate = new Date(Date.UTC(2026, 3, 27)); 
    const currentTargetDate = new Date(targetDateStr);
    let diffDays = Math.floor((currentTargetDate - launchDate) / (1000 * 60 * 60 * 24));
    
    state.puzzleNumber = diffDays + 1;
    state.targetWord = word;
    state.status = "PLAYING";
    state.currentRow = 0;
    state.board = Array.from({length: MAX_GUESSES}, () => []);
    
    const random = mulberry32(state.puzzleNumber);
    let rawBank = [...rawBankItems];
    
    for (let i = rawBank.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [rawBank[i], rawBank[j]] = [rawBank[j], rawBank[i]];
    }
    state.bank = rawBank;

    if(getEl('bank-container')) getEl('bank-container').style.display = 'block'; 
    if(getEl('endMessage')) getEl('endMessage').style.display = 'none';
    if(getEl('message')) { getEl('message').style.display = 'block'; getEl('message').innerText = ""; }
    if(getEl('shareBtn')) getEl('shareBtn').style.display = 'none'; 
    if(getEl('statsBtn')) getEl('statsBtn').style.display = 'none';
    
    if(getEl('submitBtn')) {
        getEl('submitBtn').style.display = 'block';
        getEl('submitBtn').innerText = "Submit"; 
        getEl('submitBtn').disabled = false;
    }
    if(getEl('backspaceBtn')) getEl('backspaceBtn').style.display = 'block';
    if(getEl('debugWord')) getEl('debugWord').style.visibility = 'hidden';
    
    document.body.style.pointerEvents = 'auto'; 

    initDOM(); render();
}

function initDOM() {
    const boardEl = getEl('board');
    if(!boardEl) return; 

    boardEl.innerHTML = ''; 
    for (let i = 0; i < MAX_GUESSES; i++) {
        const row = document.createElement('div');
        row.className = 'row'; row.id = `row-${i}`; row.setAttribute('role', 'row');
        row.setAttribute('aria-label', `Guess ${i + 1} of ${MAX_GUESSES}`);

        for (let j = 0; j < WORD_LENGTH; j++) {
            const tile = document.createElement('div');
            tile.className = 'board-tile'; tile.id = `tile-${i}-${j}`; tile.setAttribute('role', 'gridcell');
            tile.setAttribute('aria-label', 'Empty');

            const charSpan = document.createElement('span'); charSpan.className = 'char-span';
            charSpan.setAttribute('aria-hidden', 'true'); 
            tile.appendChild(charSpan);
            row.appendChild(tile);
        }
        boardEl.appendChild(row);
    }

    const bankEl = getEl('bank');
    if(!bankEl) return;

    bankEl.innerHTML = ''; 
    state.bank.forEach((item, index) => {
        const tile = document.createElement('div');
        tile.className = 'bank-tile'; tile.id = `bank-tile-${index}`;
        tile.setAttribute('role', 'button'); 
        tile.setAttribute('tabindex', '0');
        
        const charContainer = document.createElement('div');
        charContainer.className = 'char-container';
        charContainer.setAttribute('aria-hidden', 'true');

        const charFront = document.createElement('span');
        charFront.className = 'char-front';
        charFront.innerText = item.char;
        charContainer.appendChild(charFront);

        if (item.flipChar) {
            const charBack = document.createElement('span');
            charBack.className = 'char-back';
            charBack.innerText = item.flipChar; 
            charContainer.appendChild(charBack);

            // --- INJECTING THE NEW FLIP ICON ---
            const flipBtn = document.createElement('button');
            flipBtn.className = 'flip-btn'; 
            flipBtn.innerHTML = SVG_SPIN;
            flipBtn.setAttribute('aria-label', `Spin letter ${item.char} to ${item.flipChar}`);
            flipBtn.addEventListener('click', (e) => { e.stopPropagation(); handleFlip(index); });
            tile.appendChild(flipBtn);
        }
        tile.appendChild(charContainer);
        
        tile.addEventListener('click', () => handleAddLetter(index));
        tile.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAddLetter(index); }
        });

        bankEl.appendChild(tile);
    });
}

function render() {
    for (let r = 0; r < MAX_GUESSES; r++) {
        const rowState = state.board[r];
        const rowEl = getEl(`row-${r}`);
        if(!rowEl) continue;
        
        for (let i = 0; i < WORD_LENGTH; i++) {
            const tileState = rowState[i];
            const tileEl = getEl(`tile-${r}-${i}`);
            if(!tileEl) continue;

            const spanEl = tileEl.querySelector('.char-span');
            tileEl.className = 'board-tile';
            
            if (r === state.currentRow && state.status === "PLAYING") tileEl.classList.add('active-row');
            
            if (tileState) {
                spanEl.innerText = tileState.logicalChar; 
                
                let statusText = "unsubmitted";
                if (tileState.status === 'correct') statusText = "correct";
                else if (tileState.status === 'present') statusText = "present in wrong position";
                else if (tileState.status === 'absent') statusText = "absent";
                tileEl.setAttribute('aria-label', `${tileState.logicalChar}, ${statusText}`);

                if (tileState.status && tileState.status !== 'tbd') {
                    tileEl.classList.add(tileState.status);
                } else {
                    tileEl.classList.add('filled');
                }
            } else {
                spanEl.innerText = "";
                tileEl.setAttribute('aria-label', 'Empty');
            }
        }
    }

    state.bank.forEach((item, index) => {
        const tileEl = getEl(`bank-tile-${index}`);
        if(!tileEl) return;

        item.isFlipped ? tileEl.classList.add('flipped') : tileEl.classList.remove('flipped');
        
        let currentVisibleChar = item.isFlipped ? item.flipChar : item.char;
        let flipContext = "";
        if (item.flipChar) {
            let hiddenChar = item.isFlipped ? item.char : item.flipChar;
            flipContext = `, can be spun to ${hiddenChar}`;
        }
        tileEl.setAttribute('aria-label', `Bank letter ${currentVisibleChar}${flipContext}`);
    });
}

function showMessage(msg) {
    const msgEl = getEl('message');
    if(!msgEl) return;
    msgEl.innerText = msg;
    announce(msg);
    if (state.status === "PLAYING" && msg !== "") setTimeout(() => { msgEl.innerText = ""; }, 2500);
}

function triggerRowShake() {
    const rowEl = getEl(`row-${state.currentRow}`);
    if(!rowEl) return;
    rowEl.classList.remove('shake'); void rowEl.offsetWidth; rowEl.classList.add('shake');
    setTimeout(() => rowEl.classList.remove('shake'), SHAKE_DELAY_MS);
}

function handleAddLetter(index) {
    if (state.status !== "PLAYING" || state.board[state.currentRow].length >= WORD_LENGTH) return;
    const item = state.bank[index];
    const charToAdd = item.isFlipped ? item.flipChar : item.char;
    
    state.board[state.currentRow].push({
        logicalChar: charToAdd,
        status: 'tbd'
    });
    
    announce(`Added ${charToAdd}`); 
    render();
}

function handleFlip(index) {
    if (state.status !== "PLAYING") return;
    state.bank[index].isFlipped = !state.bank[index].isFlipped;
    const newChar = state.bank[index].isFlipped ? state.bank[index].flipChar : state.bank[index].char;
    announce(`Spun to ${newChar}`); 
    render();
}

function handleBackspace() {
    if (state.status !== "PLAYING" || state.board[state.currentRow].length === 0) return;
    const removedChar = state.board[state.currentRow].pop().logicalChar;
    announce(`Deleted ${removedChar}`); 
    render();
}

function handleSubmit() {
    if (state.status !== "PLAYING") return;
    const currentRowData = state.board[state.currentRow];
    
    if (currentRowData.length !== WORD_LENGTH) {
        showMessage("Not enough letters"); triggerRowShake(); return;
    }

    const guessString = currentRowData.map(g => g.logicalChar).join('');
    const submitBtn = getEl('submitBtn');

    state.status = "CHECKING";
    if(submitBtn) { submitBtn.innerText = "Checking..."; submitBtn.disabled = true; }
    document.body.style.pointerEvents = 'none'; 

    if (!validWords.has(guessString)) {
        showMessage("Not in word list"); triggerRowShake();
        unlockInput(); return;
    }

    if(submitBtn) submitBtn.innerText = "Submit";

    let targetArray = state.targetWord.split('');
    
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (currentRowData[i].logicalChar === targetArray[i]) {
            currentRowData[i].status = 'correct'; targetArray[i] = null; 
        }
    }
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (currentRowData[i].status === 'correct') continue;
        let targetIndex = targetArray.indexOf(currentRowData[i].logicalChar);
        if (targetIndex !== -1) {
            currentRowData[i].status = 'present'; targetArray[targetIndex] = null; 
        } else {
            currentRowData[i].status = 'absent';
        }
    }

    const rowEl = getEl(`row-${state.currentRow}`);
    if(rowEl) {
        for (let i = 0; i < WORD_LENGTH; i++) {
            setTimeout(() => {
                const tileEl = rowEl.children[i];
                tileEl.classList.remove('filled', 'active-row');
                tileEl.classList.add(currentRowData[i].status);
            }, i * ANIMATION_DELAY_MS);
        }
    }

    let resultAnnouncement = `Guess ${state.currentRow + 1} submitted. `;
    for(let i=0; i<WORD_LENGTH; i++){
        let sText = currentRowData[i].status === 'correct' ? 'correct' : (currentRowData[i].status === 'present' ? 'present in wrong position' : 'absent');
        resultAnnouncement += `Letter ${i+1}, ${currentRowData[i].logicalChar}, is ${sText}. `;
    }

    setTimeout(() => {
        announce(resultAnnouncement); 

        if (guessString === state.targetWord) {
            state.status = "WON"; handleEndGame(true);
        } else if (state.currentRow >= MAX_GUESSES - 1) { 
            state.status = "LOST"; handleEndGame(false);
        } else {
            state.currentRow++; unlockInput(); render(); 
        }
    }, WORD_LENGTH * ANIMATION_DELAY_MS + 100); 
}

function unlockInput() {
    state.status = "PLAYING";
    const submitBtn = getEl('submitBtn');
    if(submitBtn) { submitBtn.innerText = "Submit"; submitBtn.disabled = false; }
    document.body.style.pointerEvents = 'auto';
}

function handleEndGame(won) {
    document.body.style.pointerEvents = 'auto';
    updateStats(won); 

    if (won) {
        const rowEl = getEl(`row-${state.currentRow}`);
        if(rowEl) {
            for (let i = 0; i < WORD_LENGTH; i++) {
                setTimeout(() => { rowEl.children[i].classList.add('win-dance'); }, i * 100);
            }
        }
        triggerFireworks();
    }

    setTimeout(() => {
        if(getEl('message')) getEl('message').style.display = 'none'; 
        if(getEl('bank-container')) getEl('bank-container').style.display = 'none';
        if(getEl('submitBtn')) getEl('submitBtn').style.display = 'none'; 
        if(getEl('backspaceBtn')) getEl('backspaceBtn').style.display = 'none';
        
        const endMsg = getEl('endMessage');
        if(endMsg) {
            const finalPhrase = won ? "Well done!" : "Unlucky!\nThe word was " + state.targetWord.toUpperCase();
            endMsg.innerText = finalPhrase;
            endMsg.style.display = 'block';
            announce(finalPhrase); 
        }
        
        if(getEl('shareBtn')) getEl('shareBtn').style.display = 'block';
        if(getEl('statsBtn')) {
            getEl('statsBtn').style.display = 'block';
        }
        
        setTimeout(() => {
            renderStatsModal();
            if(getEl('statsModal')) getEl('statsModal').classList.remove('hidden');
        }, 1500);

    }, won ? 1200 : 1500); 
}

function triggerFireworks() {
    setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed'; canvas.style.top = '0'; canvas.style.left = '0';
        canvas.style.width = '100vw'; canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none'; canvas.style.zIndex = '9999';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;

        let particles = [];
        const colors = ['#fbbf24', '#38bdf8', '#22c55e', '#f43f5e', '#a855f7', '#ffffff'];

        for (let b = 0; b < 3; b++) {
            setTimeout(() => {
                        const originX = canvas.width / 2 + (Math.random() - 0.5) * 300;
                const originY = canvas.height / 3 + (Math.random() - 0.5) * 200;
                for (let i = 0; i < 180; i++) {
                    particles.push({
                        x: originX, y: originY,
                        vx: (Math.random() - 0.5) * (Math.random() * 25 + 5),
                        vy: (Math.random() - 0.5) * (Math.random() * 25 + 5),
                        size: Math.random() * 6 + 2, color: colors[Math.floor(Math.random() * colors.length)],
                        alpha: 1, decay: Math.random() * 0.015 + 0.005
                    });
                }
            }, b * 400); 
        }

        const startTime = performance.now();

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles = particles.filter(p => p.alpha > 0);
            
            for (let i = 0; i < particles.length; i++) {
                let p = particles[i];
                p.vy += 0.2; p.vx *= 0.98; p.vy *= 0.98;
                p.x += p.vx; p.y += p.vy; p.alpha -= p.decay;
                ctx.globalAlpha = Math.max(0, p.alpha); ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
            }
            
            if (particles.length > 0 || performance.now() - startTime < 2000) { 
                requestAnimationFrame(animate); 
            } else { 
                canvas.remove(); 
            }
        }
        animate();
    }, 500); 
}

function copyToClipboard(text) { 
    navigator.clipboard.writeText(text).then(() => {
        const shareBtn = getEl('shareBtn');
        if (shareBtn) {
            const originalText = shareBtn.innerHTML;
            shareBtn.innerHTML = "Copied!";
            announce("Copied to clipboard"); 
            setTimeout(() => { 
                shareBtn.innerHTML = originalText; 
            }, 2000);
        }
    }).catch(err => {
        alert("Failed to copy results to clipboard.");
    }); 
}

async function handleShare() {
    const attemptStr = state.status === "WON" ? state.currentRow + 1 : 'X';
    let shareText = `Flipping Letters #${state.puzzleNumber} ${attemptStr}/${MAX_GUESSES}\n\n`;
    
    for (let r = 0; r <= state.currentRow; r++) { 
        if (r >= MAX_GUESSES) break;
        const rowData = state.board[r];
        if (rowData.length === 0) continue;
        
        let rowEmoji = "";
        for (let i = 0; i < WORD_LENGTH; i++) {
            if (rowData[i].status === 'correct') rowEmoji += "🟩";
            else if (rowData[i].status === 'present') rowEmoji += "🟨";
            else rowEmoji += "⬛";
        }
        shareText += rowEmoji + "\n";
    }
    shareText += "\nPlay at: https://flippingletters.com";

    if (navigator.share) {
        try { await navigator.share({ text: shareText }); } 
        catch (err) { copyToClipboard(shareText); }
    } else { copyToClipboard(shareText); }
}

// --- RESTORED DEV EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {

    initTheme();
    if(getEl('themeBtn')) getEl('themeBtn').addEventListener('click', toggleTheme);
    if(getEl('helpBtn')) getEl('helpBtn').addEventListener('click', () => {
        getEl('tutorialModal').classList.remove('hidden');
    });

    if(getEl('submitBtn')) getEl('submitBtn').addEventListener('click', handleSubmit);
    if(getEl('backspaceBtn')) getEl('backspaceBtn').addEventListener('click', handleBackspace);
    if(getEl('shareBtn')) getEl('shareBtn').addEventListener('click', handleShare);
    
    if(getEl('statsBtn')) getEl('statsBtn').addEventListener('click', () => {
        renderStatsModal();
        getEl('statsModal').classList.remove('hidden');
    });

    if(getEl('closeStatsBtn')) getEl('closeStatsBtn').addEventListener('click', () => {
        getEl('statsModal').classList.add('hidden');
    });

    if(getEl('closeTutorialBtn')) getEl('closeTutorialBtn').addEventListener('click', () => {
        getEl('tutorialModal').classList.add('hidden'); 
    });

    if(getEl('settingsBtn')) getEl('settingsBtn').addEventListener('click', () => {
        const devMenu = getEl('debugContainer');
        if (devMenu.style.display === 'flex') {
            devMenu.style.display = 'none';
        } else {
            devMenu.style.display = 'flex';
            setTimeout(() => { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }, 50);
        }
    });

    if(getEl('resetStatsBtn')) getEl('resetStatsBtn').addEventListener('click', () => {
        if(confirm("Are you sure you want to reset all local stats?")) {
            localStorage.removeItem('flippingLettersStats');
            userStats = { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, distribution: Array(MAX_GUESSES).fill(0), lastCompletedDay: -1 };
            alert("Stats reset!");
        }
    });

    if(getEl('datePicker')) getEl('datePicker').addEventListener('change', (e) => {
        if (e.target.value !== "") initGame(e.target.value);
    });

    if(getEl('debugBtn')) getEl('debugBtn').addEventListener('click', () => {
        const debugText = getEl('debugWord');
        debugText.style.visibility = debugText.style.visibility === 'visible' ? 'hidden' : 'visible';
        debugText.innerText = state.targetWord;
    });

    document.addEventListener("keydown", (e) => {
        if(e.target.tagName === 'INPUT') return;

        if (getEl('tutorialModal') && !getEl('tutorialModal').classList.contains('hidden')) {
            if (e.key === "Enter" || e.key === "Escape") getEl('closeTutorialBtn').click(); return;
        }
        if (getEl('statsModal') && !getEl('statsModal').classList.contains('hidden')) {
            if (e.key === "Enter" || e.key === "Escape") getEl('closeStatsBtn').click(); return;
        }
        if (e.key === "Backspace") handleBackspace();
        if (e.key === "Enter") handleSubmit();
    });

    (async () => {
        await loadLocalDictionary(); 
        initGame();
    })();

});