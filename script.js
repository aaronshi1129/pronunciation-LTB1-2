import { config } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    // Home page elements
    const homePage = document.getElementById('home-page');
    const practicePage = document.getElementById('practice-page');
    const startBtn = document.getElementById('start-btn');
    const homeDifficultySelect = document.getElementById('home-difficulty');
    const homeCustomBtn = document.getElementById('home-custom-btn');
    const backToHomeBtn = document.getElementById('back-to-home');
    
    // Practice page elements
    const recordBtn = document.getElementById('recordBtn');
    const nextBtn = document.getElementById('nextBtn');
    const endBtn = document.getElementById('endBtn');
    const challengeText = document.getElementById('challenge-text');
    const recognitionResult = document.getElementById('recognition-result');
    const feedback = document.getElementById('feedback');
    const difficultySelect = document.getElementById('difficulty');
    const customBtn = document.getElementById('customBtn');
    const scoreElement = document.getElementById('score');
    const timerElement = document.getElementById('timer');
    
    // Modal elements
    const importModal = document.getElementById('importModal');
    const closeModalBtn = document.querySelector('.close');
    const importBtn = document.getElementById('importBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const customContent = document.getElementById('customContent');
    const customSetName = document.getElementById('customSetName');
    
    // Summary modal elements
    const summaryModal = document.getElementById('summaryModal');
    const closeSummaryBtn = document.querySelector('.close-summary');
    const summaryStats = document.getElementById('summaryStats');
    const backHomeBtn = document.getElementById('backHomeBtn');

    let recognition;
    let isRecording = false;
    let currentChallenge = '';
    let correctCount = 0;
    let wrongCount = 0;
    let totalAttempts = 0;
    let startTime = 0;
    let timerInterval;
    let practiceHistory = [];

    // Load custom sets from localStorage
    let customSets = JSON.parse(localStorage.getItem('customSets')) || {};

    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Your browser does not support speech recognition. Please try Chrome or Edge.');
        recordBtn.disabled = true;
    } else {
        // Initialize speech recognition
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        // Handle speech recognition results
        recognition.onresult = (event) => {
            const speechResult = event.results[0][0].transcript;
            recognitionResult.textContent = speechResult;

            // Compare the speech result with the current challenge
            checkPronunciation(speechResult, currentChallenge);
        };

        recognition.onend = () => {
            isRecording = false;
            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                </svg>
                Speak
            `;
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            isRecording = false;
            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                </svg>
                Speak
            `;

            if (event.error === 'not-allowed') {
                feedback.textContent = 'Microphone access denied. Please enable it in your browser settings.';
                feedback.className = 'feedback incorrect';
            }
        };
    }

    // Home page navigation
    startBtn.addEventListener('click', () => {
        homePage.style.display = 'none';
        practicePage.style.display = 'block';
        
        // Sync difficulty selection between home and practice pages
        difficultySelect.value = homeDifficultySelect.value;
        
        // Reset scores and timer
        resetPracticeSession();
        
        // Get first challenge
        getNextChallenge();
    });
    
    backToHomeBtn.addEventListener('click', () => {
        practicePage.style.display = 'none';
        homePage.style.display = 'block';
        
        // Sync difficulty selection between practice and home pages
        homeDifficultySelect.value = difficultySelect.value;
        
        // Clear timer
        clearInterval(timerInterval);
    });

    // Toggle recording state
    recordBtn.addEventListener('click', () => {
        if (currentChallenge === '') {
            feedback.textContent = 'Please click "Next" to get a challenge first';
            feedback.className = 'feedback incorrect';
            return;
        }

        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    });

    // Get next challenge
    nextBtn.addEventListener('click', () => {
        // If there was a word that wasn't answered, count as wrong
        if (currentChallenge !== '' && feedback.textContent === '') {
            wrongCount++;
            updateScore();
            
            // Add to history
            if (typeof currentChallenge === 'object' && currentChallenge.text) {
                practiceHistory.push({
                    word: currentChallenge.text,
                    result: 'skipped'
                });
            }
        }
        
        getNextChallenge();
    });
    
    // End practice and show summary
    endBtn.addEventListener('click', () => {
        clearInterval(timerInterval);
        showSummary();
    });
    
    // Summary modal close button
    closeSummaryBtn.addEventListener('click', () => {
        summaryModal.style.display = 'none';
    });
    
    // Back to home from summary
    backHomeBtn.addEventListener('click', () => {
        summaryModal.style.display = 'none';
        practicePage.style.display = 'none';
        homePage.style.display = 'block';
        
        // Sync difficulty selection
        homeDifficultySelect.value = difficultySelect.value;
    });

    // Update difficulty dropdown with saved custom sets
    function updateDifficultyOptions() {
        // Update both home and practice page selects
        [homeDifficultySelect, difficultySelect].forEach(select => {
            // Clear existing custom options
            Array.from(select.options).forEach(option => {
                if (option.value !== 'easy' && option.value !== 'medium' && option.value !== 'hard') {
                    select.removeChild(option);
                }
            });

            // Add custom sets to dropdown
            Object.keys(customSets).forEach(setName => {
                const option = document.createElement('option');
                option.value = setName;
                option.textContent = setName;
                select.appendChild(option);
            });
        });
    }

    // Initialize dropdown with custom sets
    updateDifficultyOptions();

    // Modal functionality for both buttons
    [homeCustomBtn, customBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            importModal.style.display = 'block';
            customContent.value = '';
            customSetName.value = '';
        });
    });

    closeModalBtn.addEventListener('click', () => {
        importModal.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        importModal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === importModal) {
            importModal.style.display = 'none';
        } else if (event.target === summaryModal) {
            summaryModal.style.display = 'none';
        }
    });

    // Import functionality
    importBtn.addEventListener('click', () => {
        try {
            const setName = customSetName.value.trim();
            // Validate set name
            if (!setName) {
                throw new Error('Please provide a name for your custom set');
            }

            // Parse comma-separated format
            const lines = customContent.value.trim().split('\n');
            const content = lines.map(line => {
                const parts = line.split(',').map(part => part.trim());
                if (parts.length < 3) {
                    throw new Error(`Line "${line}" doesn't have all required parts (text, syllables, translation)`);
                }
                return {
                    text: parts[0],
                    syllables: parts[1],
                    translation: parts[2]
                };
            });

            // Save to custom sets
            customSets[setName] = content;
            localStorage.setItem('customSets', JSON.stringify(customSets));

            // Update dropdown
            updateDifficultyOptions();

            // Show success message
            feedback.textContent = `Successfully imported ${content.length} items as "${setName}"`;
            feedback.className = 'feedback correct';

            // Close modal
            importModal.style.display = 'none';
        } catch (error) {
            alert(`Error importing content: ${error.message}`);
        }
    });

    // Function to start recording
    function startRecording() {
        if (recognition) {
            try {
                recognition.start();
                isRecording = true;
                recordBtn.classList.add('recording');
                recordBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                        <line x1="12" y1="19" x2="12" y2="22"></line>
                    </svg>
                    Recording...
                `;
                recognitionResult.textContent = 'Listening...';
                feedback.textContent = '';
                feedback.className = 'feedback';
            } catch (error) {
                console.error('Error starting recognition', error);
            }
        }
    }

    // Function to stop recording
    function stopRecording() {
        if (recognition) {
            recognition.stop();
            isRecording = false;
            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                </svg>
                Speak
            `;
        }
    }

    // Function to check pronunciation
    function checkPronunciation(spoken, challenge) {
        // Normalize both strings for comparison (remove punctuation, spaces, and make lowercase)
        const normalizeText = (text) => {
            return text.toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, "");
        };

        const normalizedSpoken = normalizeText(spoken);
        const normalizedChallenge = normalizeText(challenge.text || challenge);
        
        totalAttempts++;
        
        // Add to history
        const historyItem = {
            word: challenge.text || challenge,
            spoken: spoken
        };

        if (normalizedSpoken === normalizedChallenge) {
            feedback.textContent = 'Correct! ';
            feedback.className = 'feedback correct';
            correctCount++;
            historyItem.result = 'correct';
        } else {
            feedback.textContent = 'Try again! ';
            feedback.className = 'feedback incorrect';
            wrongCount++;
            historyItem.result = 'incorrect';
        }
        
        practiceHistory.push(historyItem);
        updateScore();
    }
    
    // Function to update score
    function updateScore() {
        scoreElement.textContent = `Correct: ${correctCount} | Wrong: ${wrongCount}`;
    }
    
    // Function to format time
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }
    
    // Function to update timer
    function updateTimer() {
        const currentTime = Math.floor((Date.now() - startTime) / 1000);
        timerElement.textContent = `Time: ${formatTime(currentTime)}`;
    }
    
    // Function to reset practice session
    function resetPracticeSession() {
        correctCount = 0;
        wrongCount = 0;
        totalAttempts = 0;
        practiceHistory = [];
        updateScore();
        
        // Reset and start timer
        startTime = Date.now();
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);
        updateTimer();
    }
    
    // Function to show summary
    function showSummary() {
        const totalTime = Math.floor((Date.now() - startTime) / 1000);
        const accuracy = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
        
        // Create summary content
        let summaryContent = `
            <div class="summary-title">Practice Summary</div>
            <div class="stat-item">
                <span class="stat-label">Total Questions Attempted:</span>
                <span class="stat-value">${totalAttempts}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Correct Answers:</span>
                <span class="stat-value good">${correctCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Wrong/Skipped Answers:</span>
                <span class="stat-value bad">${wrongCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Accuracy:</span>
                <span class="stat-value ${accuracy >= 70 ? 'good' : 'bad'}">${accuracy}%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Practice Time:</span>
                <span class="stat-value">${formatTime(totalTime)}</span>
            </div>
        `;
        
        summaryStats.innerHTML = summaryContent;
        summaryModal.style.display = 'block';
    }

    // Function to get next challenge based on difficulty
    function getNextChallenge() {
        const difficulty = difficultySelect.value;
        let challenges;

        if (difficulty === 'easy') {
            challenges = config.words;
        } else if (difficulty === 'medium') {
            challenges = config.phrases;
        } else if (difficulty === 'hard') {
            challenges = config.sentences;
        } else {
            // Custom set
            challenges = customSets[difficulty] || [];
        }

        if (challenges.length === 0) {
            feedback.textContent = 'No challenges found for this difficulty level';
            feedback.className = 'feedback incorrect';
            return;
        }

        // Get random challenge
        const randomIndex = Math.floor(Math.random() * challenges.length);
        currentChallenge = challenges[randomIndex];

        // Update UI
        challengeText.textContent = currentChallenge.text || currentChallenge;

        // Add syllables and translation
        const syllablesElement = document.getElementById('syllables');
        const translationElement = document.getElementById('translation');

        if (currentChallenge.syllables && currentChallenge.translation) {
            syllablesElement.textContent = currentChallenge.syllables;
            translationElement.textContent = currentChallenge.translation;
        } else {
            syllablesElement.textContent = '';
            translationElement.textContent = '';
        }

        recognitionResult.textContent = 'Your speech will appear here';
        feedback.textContent = '';
        feedback.className = 'feedback';
    }
});