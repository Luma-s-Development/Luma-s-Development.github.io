// Core variables
let rhythmActive = false;
let rhythmLanes = [];
let rhythmKeys = [];
let rhythmNotes = [];
let currentCombo = 0;
let maxCombo = 0;
let totalScore = 0;
let noteSpeed = 300; // pixels per second
let noteSpawnRate = 1000; // ms between notes
let spawnInterval;
let moveInterval;
let totalNotes = 0;
let notesHit = 0;
let wrongKeyCount = 0;
let maxWrongKeys = 5;
let activeLane = -1;
let gameProgress = 0;
let requiredNotes = 20;
let lastHitTime = 0;
let missedNotes = 0;
let maxMissedNotes = 3; // Default value

// Timing windows in milliseconds
const timingWindows = {
    perfect: 10,  // ±50ms
    great: 15,   // ±100ms
    okay: 20     // ±200ms
};

// Scoring values
const scoreValues = {
    perfect: 100,
    great: 50,
    okay: 20,
    miss: 0
};

// Default rhythm config
let rhythmConfig = {
    lanes: 4,
    keys: ['A', 'S', 'D', 'F'],
    noteSpeed: 300,
    noteSpawnRate: 1000,
    requiredNotes: 20,
    maxWrongKeys: 5,
    maxMissedNotes: 3, // New parameter
    difficulty: 'normal'
};

// Function to set up the rhythm game
function setupRhythmGame(config) {
    // Apply configuration or use defaults
    rhythmConfig = {
        lanes: config?.lanes || 4,
        keys: config?.keys || ['A', 'S', 'D', 'F'],
        noteSpeed: config?.noteSpeed || 300,
        noteSpawnRate: config?.noteSpawnRate || 1000,
        requiredNotes: config?.requiredNotes || 20,
        maxWrongKeys: config?.maxWrongKeys || 5,
        maxMissedNotes: config?.maxMissedNotes || 3,
        difficulty: config?.difficulty || 'normal'
    };

    // Adjust timing windows based on difficulty
    if (rhythmConfig.difficulty === 'easy') {
        Object.keys(timingWindows).forEach(key => timingWindows[key] *= 1.5);
    } else if (rhythmConfig.difficulty === 'hard') {
        Object.keys(timingWindows).forEach(key => timingWindows[key] *= 0.7);
    }

    // Ensure we don't have more keys than lanes
    if (rhythmConfig.keys.length > rhythmConfig.lanes) {
        rhythmConfig.keys = rhythmConfig.keys.slice(0, rhythmConfig.lanes);
    }

    // Fill missing keys if necessary
    while (rhythmConfig.keys.length < rhythmConfig.lanes) {
        rhythmConfig.keys.push(String.fromCharCode(65 + rhythmConfig.keys.length));
    }

    // Set the game variables from config
    noteSpeed = rhythmConfig.noteSpeed;
    noteSpawnRate = rhythmConfig.noteSpawnRate;
    requiredNotes = rhythmConfig.requiredNotes;
    maxWrongKeys = rhythmConfig.maxWrongKeys;
    maxMissedNotes = rhythmConfig.maxMissedNotes; // Set the max missed notes
    rhythmLanes = Array(rhythmConfig.lanes).fill(0);
    rhythmKeys = rhythmConfig.keys;
    
    // Update key hint text
    $('#rhythm-key-hint').text('Press ' + rhythmKeys.join(', ') + ' to hit the notes');
    
    // Reset game state
    resetRhythmGame();
}

// Function to build the rhythm game UI
function buildRhythmUI() {
    const highway = $('.rhythm-highway');
    const keyIndicators = $('.key-indicators');
    
    // Clear existing elements
    highway.empty();
    keyIndicators.empty();
    
    // Create lanes and key indicators
    for (let i = 0; i < rhythmConfig.lanes; i++) {
        // Create lane
        const lane = $('<div class="rhythm-lane"></div>');
        highway.append(lane);
        
        // Create key indicator
        const keyIndicator = $('<div class="key-indicator"></div>');
        keyIndicator.text(rhythmKeys[i]);
        keyIndicator.attr('data-lane', i);
        keyIndicators.append(keyIndicator);
        
        // Create feedback display for this lane
        const feedback = $('<div class="rhythm-feedback" data-lane="' + i + '"></div>');
        lane.append(feedback);
    }
}

// Function to spawn a note
function spawnNote() {
    if (!rhythmActive) return;
    
    // Decide which lane to spawn in (can include logic for patterns)
    const lane = Math.floor(Math.random() * rhythmConfig.lanes);
    
    // Create the note DOM element
    const highway = $('.rhythm-highway');
    const laneEl = highway.find('.rhythm-lane').eq(lane);
    
    const note = $('<div class="rhythm-note"></div>');
    note.css('top', '-20px'); // Start above the visible area
    laneEl.append(note);
    
    // Add to notes array with metadata
    rhythmNotes.push({
        element: note,
        lane: lane,
        position: -20,
        startTime: Date.now(),
        hit: false
    });
    
    totalNotes++;
    updateProgressBar();
}

// Function to move all notes
function moveNotes() {
    if (!rhythmActive) return;
    
    const now = Date.now();
    const hitZonePos = $('.hit-zone').position().top;
    const moveAmount = noteSpeed / 60; // For 60fps, adjust distance per frame
    
    // Update each note position
    for (let i = rhythmNotes.length - 1; i >= 0; i--) {
        const note = rhythmNotes[i];
        
        if (note.hit) continue; // Skip notes already hit
        
        // Update position
        note.position += moveAmount;
        note.element.css('top', note.position + 'px');
        
        // Check if note is past hit zone without being hit
        if (note.position > hitZonePos + 50) {
            // Note missed
            showFeedback(note.lane, 'miss');
            breakCombo();
            
            // Increment missed notes counter
            missedNotes++;
            
            // Display missed notes status
            $('#rhythm-message').text(`Missed ${missedNotes}/${maxMissedNotes} notes allowed`);
            
            // Check for failure condition - too many missed notes
            if (missedNotes >= maxMissedNotes) {
                stopRhythmGame(false);
            }
            
            // Remove note from DOM and array
            note.element.remove();
            rhythmNotes.splice(i, 1);
        }
    }
}

// Function to handle key press
function handleRhythmKeyPress(e) {
    if (!rhythmActive) return;
    
    const keyPressed = String.fromCharCode(e.keyCode);
    const laneIndex = rhythmKeys.indexOf(keyPressed);
    
    // Invalid key
    if (laneIndex === -1) return;
    
    // Highlight key indicator
    $('.key-indicator').eq(laneIndex).addClass('active');
    
    // Check for notes in this lane
    const hitZonePos = $('.hit-zone').position().top;
    let noteHit = false;
    let hitTiming = 'miss';
    let hitNoteIndex = -1;
    
    // Find the closest note to hit zone in this lane
    let closestNote = null;
    let closestDistance = Infinity;
    
    rhythmNotes.forEach((note, index) => {
        if (note.lane === laneIndex && !note.hit) {
            const distance = Math.abs(note.position - hitZonePos);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestNote = note;
                hitNoteIndex = index;
            }
        }
    });
    
    // Process hit if we found a note
    if (closestNote) {
        // Determine hit timing based on distance from hit zone
        if (closestDistance <= timingWindows.perfect) {
            hitTiming = 'perfect';
            noteHit = true;
        } else if (closestDistance <= timingWindows.great) {
            hitTiming = 'great';
            noteHit = true;
        } else if (closestDistance <= timingWindows.okay) {
            hitTiming = 'okay';
            noteHit = true;
        }
        
        if (noteHit) {
            // Mark note as hit and remove it
            closestNote.hit = true;
            closestNote.element.remove();
            rhythmNotes.splice(hitNoteIndex, 1);
            
            // Update score and combo
            updateScore(hitTiming);
            increaseCombo();
            showFeedback(laneIndex, hitTiming);
            notesHit++;
            updateProgressBar();
            
            // Play sound based on hit timing
            if (hitTiming === 'perfect') {
                playSoundSafe('sound-click');
            } else if (hitTiming === 'great') {
                playSoundSafe('sound-click');
            } else {
                playSoundSafe('sound-click');
            }
            
            lastHitTime = Date.now();
        }
    } else {
        // Wrong key (no note to hit)
        wrongKeyCount++;
        playSoundSafe('sound-penalty');
        breakCombo();
        showFeedback(laneIndex, 'miss');
        
        // Check for failure condition
        if (wrongKeyCount >= maxWrongKeys) {
            stopRhythmGame(false);
        }
    }
}

// Function to handle key release
function handleRhythmKeyRelease(e) {
    if (!rhythmActive) return;
    
    const keyReleased = String.fromCharCode(e.keyCode);
    const laneIndex = rhythmKeys.indexOf(keyReleased);
    
    // Invalid key
    if (laneIndex === -1) return;
    
    // Remove highlight from key indicator
    $('.key-indicator').eq(laneIndex).removeClass('active');
}

// Function to update score based on hit timing
function updateScore(timing) {
    // Apply combo multiplier (combo / 10 + 1)
    const multiplier = Math.floor(currentCombo / 10) + 1;
    const points = scoreValues[timing] * multiplier;
    
    totalScore += points;
    $('#rhythm-score').text(totalScore);
}

// Function to increase combo
function increaseCombo() {
    currentCombo++;
    
    if (currentCombo > maxCombo) {
        maxCombo = currentCombo;
    }
    
    $('#combo-number').text(currentCombo);
    
    // Add visual effect for combo milestones
    if (currentCombo > 0 && currentCombo % 10 === 0) {
        $('#combo-number').addClass('combo-highlight');
        playSoundSafe('sound-success');
        setTimeout(() => {
            $('#combo-number').removeClass('combo-highlight');
        }, 500);
    }
}

// Function to break combo
function breakCombo() {
    currentCombo = 0;
    $('#combo-number').text('0');
}

// Function to show feedback in lane
function showFeedback(lane, timing) {
    const feedback = $(`.rhythm-feedback[data-lane="${lane}"]`);
    
    // Set text and class based on timing
    feedback.text(timing.toUpperCase());
    feedback.removeClass('feedback-perfect feedback-great feedback-okay feedback-miss');
    feedback.addClass(`feedback-${timing}`);
    
    // Show and animate
    feedback.addClass('feedback-show');
    
    // Remove classes after animation
    setTimeout(() => {
        feedback.removeClass('feedback-show');
    }, 500);
}

// Function to update progress bar
function updateProgressBar() {
    gameProgress = Math.min(100, Math.round((notesHit / requiredNotes) * 100));
    $('.rhythm-progress').css('width', gameProgress + '%');
    $('#rhythm-progress').text(gameProgress);
    
    // Check for game completion
    if (notesHit >= requiredNotes) {
        stopRhythmGame(true);
    }
}

// Function to reset the rhythm game
function resetRhythmGame() {
    currentCombo = 0;
    maxCombo = 0;
    totalScore = 0;
    totalNotes = 0;
    notesHit = 0;
    wrongKeyCount = 0;
    missedNotes = 0; // Reset missed notes counter
    rhythmNotes = [];
    gameProgress = 0;
    
    // Update UI
    $('#rhythm-score').text('0');
    $('#combo-number').text('0');
    $('#rhythm-progress').text('0');
    $('.rhythm-progress').css('width', '0%');
    $('#rhythm-message').text('Hit the notes in sync with the beat');
}

// Function to start the rhythm game
function startRhythmGame() {
    rhythmActive = true;
    
    // Build UI
    buildRhythmUI();
    
    // Reset game state
    resetRhythmGame();
    
    // Clear any existing notes
    $('.rhythm-note').remove();
    
    // Start note spawning and movement
    spawnInterval = setInterval(spawnNote, noteSpawnRate);
    moveInterval = setInterval(moveNotes, 1000 / 60); // 60fps
    
    // Add key event listeners
    document.addEventListener('keydown', handleRhythmKeyPress);
    document.addEventListener('keyup', handleRhythmKeyRelease);
}

// Function to stop the rhythm game
function stopRhythmGame(success) {
    rhythmActive = false;
    
    // Stop intervals
    clearInterval(spawnInterval);
    clearInterval(moveInterval);
    
    // Remove event listeners
    document.removeEventListener('keydown', handleRhythmKeyPress);
    document.removeEventListener('keyup', handleRhythmKeyRelease);
    
    // Update message
    if (success) {
        $('#rhythm-message').text('SYNCHRONIZATION COMPLETE! Circuit stabilized.');
        playSoundSafe('sound-success');
    } else {
        // Show specific failure reason
        if (missedNotes >= maxMissedNotes) {
            $('#rhythm-message').text('SYNCHRONIZATION FAILED! Too many missed notes.');
        } else if (wrongKeyCount >= maxWrongKeys) {
            $('#rhythm-message').text('SYNCHRONIZATION FAILED! Too many wrong inputs.');
        } else {
            $('#rhythm-message').text('SYNCHRONIZATION FAILED! Circuit overloaded.');
        }
        playSoundSafe('sound-failure');
    }
    
    // Send result to FiveM after delay
    setTimeout(() => {
        const result = {
            success: success,
            score: totalScore,
            maxCombo: maxCombo,
            notesHit: notesHit,
            totalNotes: totalNotes,
            accuracy: notesHit > 0 ? Math.round((notesHit / totalNotes) * 100) : 0
        };
        
        $.post('https://luma-minigames/rhythmResult', JSON.stringify(result));
        $('#rhythm-container').fadeOut(500);
    }, 2000);
}

// Register message event for rhythm game
$(document).ready(function() {
    // Add rhythm game message handling to the existing message event listener
    // This will be added by our initialization code in app.js
});