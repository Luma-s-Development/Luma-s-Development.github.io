let isActive = false;
let direction = 1; // 1 = right, -1 = left
let position = 0;
let speed = 2;
let pulseWidth;
let trackWidth;
let safeZoneLeft;
let safeZoneRight;
let safeZoneWidth;
let successCount = 0;
let animationFrame;
let canClick = true;
let timeLimit = 10; // Default time limit in seconds
let timeRemaining = 0;
let timerInterval;
let hackConfig = {
    requiredHacks: 3,
    initialSpeed: 2,
    maxSpeed: 10,
    timeLimit: 10,
    safeZoneMinWidth: 40,
    safeZoneMaxWidth: 120,
    safeZoneShrinkAmount: 10
};

// Backdoor Sequence Game Logic
let sequenceActive = false;
let currentSequence = [];
let currentStage = 0;  // Track the current stage instead of individual keys
let stageKeys = [];    // Will hold arrays of keys for each stage
let pressedKeys = [];  // Track which keys have been pressed in current stage
let sequenceAttempts = 0;
let sequenceSuccesses = 0;
let sequenceConfig = {
    requiredSequences: 3,
    sequenceLength: 5,
    timeLimit: 15,
    maxAttempts: 3,
    possibleKeys: ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    keyHintText: 'W, A, S, D, ←, →, ↑, ↓, 0-9',
    minSimultaneousKeys: 1,
    maxSimultaneousKeys: 3
};
let sequenceTimeRemaining = 0;
let sequenceTimerInterval;

// Add time penalty config
let timePenalty = 1.0; // Default time penalty in seconds

// Key code mapping
const keyCodeMap = {
    87: 'W',    // W
    65: 'A',    // A
    83: 'S',    // S
    68: 'D',    // D
    38: 'UP',   // Up arrow
    40: 'DOWN', // Down arrow
    37: 'LEFT', // Left arrow
    39: 'RIGHT',// Right arrow
    48: '0',    // 0
    49: '1',    // 1
    50: '2',    // 2
    51: '3',    // 3
    52: '4',    // 4
    53: '5',    // 5
    54: '6',    // 6
    55: '7',    // 7
    56: '8',    // 8
    57: '9'     // 9
};

$(document).ready(function() {
    window.addEventListener('message', function(event) {
        const data = event.data;
        
        if (data.action === 'start') {
            // Reset visual state before showing UI
            $('.pulse-bar').removeClass('success-bar fail-bar');
            
            if (data.config) {
                // Apply configuration from export call
                hackConfig = {
                    requiredHacks: data.config.requiredHacks || 3,
                    initialSpeed: data.config.initialSpeed || 2,
                    maxSpeed: data.config.maxSpeed || 10,
                    timeLimit: data.config.timeLimit || 10,
                    safeZoneMinWidth: data.config.safeZoneMinWidth || 40,
                    safeZoneMaxWidth: data.config.safeZoneMaxWidth || 120,
                    safeZoneShrinkAmount: data.config.safeZoneShrinkAmount || 10
                };
            }
            
            $('body').removeClass('sequence-active'); // Ensure cursor is visible
            $('#hack-container').fadeIn(500);
            startGame();
        } else if (data.action === 'end') {
            $('#hack-container').fadeOut(500);
            stopGame();
        } else if (data.action === 'updateSpeed') {
            speed = Math.min(hackConfig.maxSpeed, speed + 1); // Increase speed on success
        } else if (data.action === 'startSequence') {
            if (data.hideCursor) {
                $('body').addClass('sequence-active'); // Hide cursor
            }
            $('#sequence-container').fadeIn(500);
            startSequenceGame(data.config);
        } else if (data.action === 'endSequence') {
            sequenceActive = false;
            clearInterval(sequenceTimerInterval);
            document.removeEventListener('keydown', handleSequenceKeyPress);
            $('body').removeClass('sequence-active'); // Show cursor again
            $('#sequence-container').fadeOut(500);
        } else if (data.action === 'startRhythm') {
            $('body').removeClass('sequence-active'); // Ensure cursor is visible
            $('#rhythm-container').fadeIn(500);
            
            // Setup and start the rhythm game with config
            setupRhythmGame(data.config);
            startRhythmGame();
        } else if (data.action === 'endRhythm') {
            rhythmActive = false;
            clearInterval(spawnInterval);
            clearInterval(moveInterval);
            document.removeEventListener('keydown', handleRhythmKeyPress);
            document.removeEventListener('keyup', handleRhythmKeyRelease);
            $('#rhythm-container').fadeOut(500);
        } else if (data.action === 'startKeymash') {
            // Setup and start the keymash game
            window.keymashFunctions.setup(data.config);
            window.keymashFunctions.start();
        } else if (data.action === 'keyPress') {
            // Handle key press from FiveM
            window.keymashFunctions.handleKeypress(data.keyCode);
        } else if (data.action === 'stopKeymash') {
            // Force stop the keymash game
            window.keymashFunctions.stop(false);
        }
    });
    
    $('#hack-button').on('click', function() {
        if (!isActive || !canClick) return;
        
        // Prevent multiple clicks
        canClick = false;
        setTimeout(() => { canClick = true; }, 100);
        
        // Check result
        checkResult();
    });
    
    // Preload sounds
    preloadSounds();
});

// Improved sound system
let soundsEnabled = true;

// Function to preload sounds with better error handling
function preloadSounds() {
    const sounds = ['sound-click', 'sound-success', 'sound-failure', 'sound-penalty'];
    let failedSounds = 0;
    
    for (const soundId of sounds) {
        const sound = document.getElementById(soundId);
        if (sound) {
            // Add error handler
            sound.addEventListener('error', function() {
                console.warn(`Failed to load sound: ${soundId}`);
                failedSounds++;
                if (failedSounds >= sounds.length) {
                    console.warn('All sounds failed to load, disabling sound system');
                    soundsEnabled = false;
                }
            });
            
            // Add load success handler
            sound.addEventListener('canplaythrough', function() {
                console.log(`Sound loaded successfully: ${soundId}`);
            });
            
            // Force reload
            sound.load();
        } else {
            console.warn(`Sound element with ID "${soundId}" not found for preloading`);
            failedSounds++;
        }
    }
    
    // Set a timeout to check if sounds are working
    setTimeout(() => {
        if (failedSounds >= sounds.length) {
            console.warn('No sounds loaded after timeout, disabling sound system');
            soundsEnabled = false;
        }
    }, 3000);
}

// Improved sound playing function
function playSound(soundId) {
    // Skip if sounds are disabled
    if (!soundsEnabled) return;
    
    const sound = document.getElementById(soundId);
    if (!sound) {
        console.warn(`Sound element with ID "${soundId}" not found`);
        return;
    }
    
    // Use a try-catch to handle potential errors
    try {
        sound.currentTime = 0;
        let playPromise = sound.play();
        
        // Handle the promise (required for modern browsers)
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.warn(`Sound "${soundId}" failed to play:`, e.message);
            });
        }
    } catch (e) {
        console.warn(`Error playing sound "${soundId}":`, e.message);
    }
}

// Add this helper function that doesn't throw errors
function playSoundSafe(soundId) {
    if (!soundsEnabled) return;
    
    try {
        playSound(soundId);
    } catch(e) {
        console.warn(`Failed to play ${soundId} safely, continuing anyway`);
    }
}

// Update the startSequenceGame function to ensure no penalty is shown
function startSequenceGame(config) {
    if (config) {
        sequenceConfig = {
            requiredSequences: config.requiredSequences || 3,
            sequenceLength: config.sequenceLength || 5,
            timeLimit: config.timeLimit || 15,
            maxAttempts: config.maxAttempts || 3,
            possibleKeys: config.possibleKeys || ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
            keyHintText: config.keyHintText || 'W, A, S, D, ←, →, ↑, ↓, 0-9',
            minSimultaneousKeys: config.minSimultaneousKeys || 1,
            maxSimultaneousKeys: config.maxSimultaneousKeys || 3,
            timePenalty: config.timePenalty || 1.0
        };
        
        // Ensure min isn't greater than max
        if (sequenceConfig.minSimultaneousKeys > sequenceConfig.maxSimultaneousKeys) {
            sequenceConfig.minSimultaneousKeys = sequenceConfig.maxSimultaneousKeys;
        }
        
        // Ensure max isn't larger than sequence length
        if (sequenceConfig.maxSimultaneousKeys > sequenceConfig.sequenceLength) {
            sequenceConfig.maxSimultaneousKeys = sequenceConfig.sequenceLength;
        }
        
        // Set time penalty if provided
        timePenalty = config.timePenalty || 1.0;
    }

    // Ensure the time penalty display is hidden at start
    $('#time-penalty').removeClass('show').text('');
    
    sequenceActive = true;
    currentSequence = [];
    stageKeys = [];
    pressedKeys = [];
    currentStage = 0;
    sequenceAttempts = 0;
    sequenceSuccesses = 0;
    
    // Update UI
    $('#seq-counter').text(sequenceSuccesses);
    $('#seq-total').text(sequenceConfig.requiredSequences);
    $('#seq-message').text('Input the sequence to break the encryption');
    
    // Update key hint text if provided
    $('.key-hint').text(sequenceConfig.keyHintText);
    
    // Reset attempt indicators
    $('.attempt-indicator').removeClass('active success failure');
    $('.attempt-indicator').first().addClass('active');
    
    // Generate a new sequence
    generateNewSequence();
    
    // Start the timer
    startSequenceTimer();
    
    // Add keyboard event listener
    document.addEventListener('keydown', handleSequenceKeyPress);
}

// Updated function to generate a sequence with multiple simultaneous keys per stage
// that allows key reuse when necessary
function generateNewSequence() {
    currentSequence = [];
    stageKeys = [];
    pressedKeys = [];
    currentStage = 0;
    
    const keySet = sequenceConfig.possibleKeys || ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    
    // Get min/max keys per stage from config
    const minKeys = Math.max(1, sequenceConfig.minSimultaneousKeys);
    const maxKeys = Math.min(sequenceConfig.sequenceLength, sequenceConfig.maxSimultaneousKeys);
    
    console.log("Min keys:", minKeys, "Max keys:", maxKeys);
    console.log("Available keys:", keySet);
    
    // Generate stages of keys
    let totalKeys = 0;
    while (totalKeys < sequenceConfig.sequenceLength) {
        // Calculate how many keys to add in this stage
        const keysLeftToAdd = sequenceConfig.sequenceLength - totalKeys;
        const numKeys = Math.min(keysLeftToAdd, 
            (minKeys === maxKeys) ? minKeys : 
            Math.floor(Math.random() * (maxKeys - minKeys + 1)) + minKeys);
            
        console.log("Adding", numKeys, "keys in this stage");
        
        // Generate keys for this stage (allow reuse if necessary)
        const stageKeySet = [];
        
        for (let i = 0; i < numKeys; i++) {
            // If we have fewer keys than required, allow reuse
            const randomIndex = Math.floor(Math.random() * keySet.length);
            const key = keySet[randomIndex];
            
            // Add the key to this stage
            stageKeySet.push(key);
            currentSequence.push(key);
        }
        
        stageKeys.push(stageKeySet);
        totalKeys += stageKeySet.length;
    }
    
    // For debugging - log the results
    console.log("Generated stages:", stageKeys);
    console.log("Total keys in sequence:", totalKeys);
    
    // Initialize pressed keys array for the first stage
    resetPressedKeys();
    
    // Update UI display
    updateSequenceDisplay();
}

// Add a nextExpectedKeyIndex to track left-to-right order
let nextExpectedKeyIndex = 0;

// Reset the pressed keys array for the current stage
function resetPressedKeys() {
    if (currentStage < stageKeys.length) {
        pressedKeys = Array(stageKeys[currentStage].length).fill(false);
        nextExpectedKeyIndex = 0; // Reset the expected key index
    }
}

// Update the sequence display in the UI to create a flowing list effect
function updateSequenceDisplay() {
    // Clear previous display
    $('.previous-keys').empty();
    $('.current-key').empty();
    $('.next-keys').empty();
    
    // Calculate which stages to show (limit previous stages to avoid stacking)
    const maxPreviousStages = 1; // Show only the most recent completed stage
    const startPrevious = Math.max(0, currentStage - maxPreviousStages);
    
    // Add limited previous stages (only most recent ones)
    for (let i = startPrevious; i < currentStage; i++) {
        const stageGroup = $('<div class="stage-group"></div>');
        for (let j = 0; j < stageKeys[i].length; j++) {
            stageGroup.append(`<div class="key-box correct">${formatKeyDisplay(stageKeys[i][j])}</div>`);
        }
        $('.previous-keys').append(stageGroup);
    }
    
    // Add current stage
    if (currentStage < stageKeys.length) {
        const currentGroup = $('<div class="stage-group current-stage"></div>');
        const allKeysPressed = pressedKeys.every(pressed => pressed);
        
        for (let i = 0; i < stageKeys[currentStage].length; i++) {
            // Key class based on state
            let keyClass = "current";
            if (allKeysPressed) {
                keyClass = "correct";
            } else if (pressedKeys[i]) {
                keyClass = "pressed";
            }
            
            currentGroup.append(`<div class="key-box ${keyClass}">${formatKeyDisplay(stageKeys[currentStage][i])}</div>`);
        }
        $('.current-key').append(currentGroup);
    }
    
    // Add ONLY the next stage (one stage ahead), not multiple upcoming stages
    if (currentStage + 1 < stageKeys.length) {
        const nextGroup = $('<div class="stage-group"></div>');
        for (let j = 0; j < stageKeys[currentStage + 1].length; j++) {
            nextGroup.append(`<div class="key-box next">${formatKeyDisplay(stageKeys[currentStage + 1][j])}</div>`);
        }
        $('.next-keys').append(nextGroup);
    }
}

// Format key display for UI
function formatKeyDisplay(key) {
    switch(key) {
        case 'UP': return '↑';
        case 'DOWN': return '↓';
        case 'LEFT': return '←';
        case 'RIGHT': return '→';
        default: return key;
    }
}

// Handle keyboard input for multiple simultaneous keys
function handleSequenceKeyPress(e) {
    if (!sequenceActive || currentStage >= stageKeys.length) return;
    
    const keyPressed = keyCodeMap[e.keyCode];
    
    // If the key pressed isn't in our map, ignore it
    if (!keyPressed) return;
    
    // Find the index of the next unpressed occurrence of this key
    let keyIndex = -1;
    for (let i = 0; i < stageKeys[currentStage].length; i++) {
        if (stageKeys[currentStage][i] === keyPressed && !pressedKeys[i]) {
            keyIndex = i;
            break;
        }
    }
    
    if (keyIndex !== -1) {
        // Check if keys are being pressed in left-to-right order
        if (keyIndex === nextExpectedKeyIndex) {
            // Key is correct and in the right order
            playSoundSafe('sound-click');
            
            // Mark key as pressed
            pressedKeys[keyIndex] = true;
            nextExpectedKeyIndex++; // Move to the next expected key
            
            // Update display immediately to show individual key press
            updateSequenceDisplay();
            
            // Check if all keys in this stage are pressed
            if (pressedKeys.every(pressed => pressed)) {
                // All keys are pressed! Show completed state first, then move to next stage
                setTimeout(() => {
                    // Move to next stage
                    currentStage++;
                    
                    // Check if sequence is complete
                    if (currentStage >= stageKeys.length) {
                        handleSequenceSuccess();
                    } else {
                        // Initialize pressed keys for next stage
                        resetPressedKeys();
                        updateSequenceDisplay();
                    }
                }, 300); // Short delay to show the completed state
            }
        } else {
            // Key is correct but wrong order - apply order penalty
            $('#seq-message').text('Press keys from LEFT to RIGHT!');
            applyTimePenalty('Wrong key order!');
        }
    } else {
        // Key is incorrect - apply time penalty
        applyTimePenalty('Incorrect key!');
    }
}

// Handle successful sequence completion
function handleSequenceSuccess() {
    sequenceSuccesses++;
    $('#seq-counter').text(sequenceSuccesses);
    
    // Play success sound safely
    playSoundSafe('sound-success');
    
    // Update attempt indicator
    $(`.sequence-attempt[data-attempt="${sequenceSuccesses}"] .attempt-indicator`)
        .removeClass('active')
        .addClass('success');
    
    if (sequenceSuccesses >= sequenceConfig.requiredSequences) {
        // All sequences completed!
        $('#seq-message').text('ACCESS GRANTED! All firewalls breached.');
        
        // Stop the game
        stopSequenceGame(true);
    } else {
        // More sequences to go
        $('#seq-message').text('Sequence correct! Initiating next security layer...');
        
        // Update active indicator
        $(`.sequence-attempt[data-attempt="${sequenceSuccesses + 1}"] .attempt-indicator`).addClass('active');
        
        // Reset timer
        resetSequenceTimer();
        
        // Generate next sequence
        setTimeout(() => {
            generateNewSequence();
        }, 1000);
    }
}

// Handle failed sequence attempt
function handleSequenceFail(isKeyError) {
    sequenceAttempts++;
    
    // Show error
    $('.current-key .key-box').removeClass('current').addClass('wrong');
    $('#seq-message').text('Incorrect input! Security breach detected.');
    
    // Try to play sound safely, but don't let failure block execution
    playSoundSafe('sound-failure');
    
    if (isKeyError) {
        // Apply time penalty for wrong key
        applyTimePenalty();
    }
    
    if (sequenceAttempts >= sequenceConfig.maxAttempts) {
        // Max attempts reached, fail the game
        $(`.sequence-attempt[data-attempt="${sequenceSuccesses + 1}"] .attempt-indicator`)
            .removeClass('active')
            .addClass('failure');
        
        stopSequenceGame(false);
    } else {
        // Reset the current sequence
        setTimeout(() => {
            currentKeyIndex = 0;
            updateSequenceDisplay();
            $('#seq-message').text('Attempt failed. Try again.');
        }, 1000);
    }
}

// Add function to apply time penalty with a reason
function applyTimePenalty(reason = 'Wrong input!') {
    // Reduce time remaining
    sequenceTimeRemaining = Math.max(0, sequenceTimeRemaining - timePenalty);
    
    // Update display
    updateSequenceTimerDisplay();
    
    // Update timer bar
    const percentage = (sequenceTimeRemaining / sequenceConfig.timeLimit) * 100;
    $('.seq-timer-progress').css('width', percentage + '%');
    
    // Show penalty indicator with reason
    // First reset any animation in progress
    $('#time-penalty').removeClass('show');
    
    // Force browser to recognize the change
    setTimeout(() => {
        // Update text and show
        $('#time-penalty').text('-' + timePenalty.toFixed(1) + 's');
        $('#time-penalty').addClass('show');
        
        // Play penalty sound safely
        playSoundSafe('sound-penalty');
    }, 10);
    
    // Check if time ran out
    if (sequenceTimeRemaining <= 0) {
        clearInterval(sequenceTimerInterval);
        handleSequenceTimeout();
    }
}

// Start the sequence timer
function startSequenceTimer() {
    sequenceTimeRemaining = sequenceConfig.timeLimit;
    updateSequenceTimerDisplay();
    $('.seq-timer-progress').css('width', '100%');
    clearInterval(sequenceTimerInterval);
    sequenceTimerInterval = setInterval(function() {
        sequenceTimeRemaining -= 0.1;
        sequenceTimeRemaining = Math.max(0, parseFloat(sequenceTimeRemaining.toFixed(1)));
        
        // Update timer display
        updateSequenceTimerDisplay();
        
        // Update timer bar
        const percentage = (sequenceTimeRemaining / sequenceConfig.timeLimit) * 100;
        $('.seq-timer-progress').css('width', percentage + '%');
        
        // Check if time ran out
        if (sequenceTimeRemaining <= 0) {
            clearInterval(sequenceTimerInterval);
            handleSequenceTimeout();
        }
    }, 100);
}

// Reset the sequence timer
function resetSequenceTimer() {
    clearInterval(sequenceTimerInterval);
    startSequenceTimer();
}

// Update sequence timer display
function updateSequenceTimerDisplay() {
    $('#seq-timer-count').text(sequenceTimeRemaining.toFixed(1));
}

// Handle timeout
function handleSequenceTimeout() {
    $('#seq-message').text('Time expired! Security lockdown initiated.');
    // Mark current attempt as failed
    $(`.sequence-attempt[data-attempt="${sequenceSuccesses + 1}"] .attempt-indicator`)
        .removeClass('active')
        .addClass('failure');
    stopSequenceGame(false);
}

// Stop the sequence game
function stopSequenceGame(success) {
    sequenceActive = false;
    clearInterval(sequenceTimerInterval);
    document.removeEventListener('keydown', handleSequenceKeyPress);
    setTimeout(() => {
        // Remove sequence-active class to show cursor
        $('body').removeClass('sequence-active');
        // Send result back to the FiveM client
        $.post('https://luma-minigames/sequenceResult', JSON.stringify({ success: success }));
        // Hide the UI
        $('#sequence-container').fadeOut(500);
    }, 2000);
}

function startGame() {
    isActive = true;
    canClick = true;
    successCount = 0;
    speed = hackConfig.initialSpeed;
    updateCounter();
    // Reset visual state of the pulse bar by removing any success/fail classes
    $('.pulse-bar').removeClass('success-bar fail-bar');
    pulseWidth = $('.pulse-bar').width();
    trackWidth = $('.pulse-track').width() - pulseWidth;
    // Set initial safe zone width based on config
    const safeZone = $('.safe-zone');
    safeZoneWidth = hackConfig.safeZoneMaxWidth;
    safeZone.width(safeZoneWidth);
    // Initial position
    repositionSafeZone();
    position = 0;
    $('#message').text('Click to stop the pulse inside the safe zone');
    // Update total required hacks
    $('#total-hacks').text(hackConfig.requiredHacks);
    startTimer();
    startPulse();
}

function stopGame() {
    isActive = false;
    stopTimer();
    cancelAnimationFrame(animationFrame);
    $('.pulse-bar').removeClass('success-bar fail-bar');
}

function startPulse() {
    animatePulse();
}

function stopPulse() {
    cancelAnimationFrame(animationFrame);
}

function animatePulse() {
    if (!isActive) return;
    // Reverse direction when hitting edges
    position += direction * speed;
    
    // Check if we hit boundaries and reverse direction
    if (position >= trackWidth || position <= 0) {
        direction *= -1;
    }
    
    // Constrain position within bounds
    position = Math.max(0, Math.min(trackWidth, position));
    
    // Update visual position
    $('.pulse-bar').css('left', position + 'px');
    
    // Continue animation
    animationId = requestAnimationFrame(animatePulse);
}

function repositionSafeZone() {
    // Get safe zone and track width
    const trackWidth = $('.pulse-track').width();
    const safeZone = $('.safe-zone');
    // Calculate new position (leave margin on edges)
    const margin = safeZoneWidth * 0.75;
    const maxPosition = trackWidth - safeZoneWidth - margin;
    const minPosition = margin;
    
    // Random position between min and max
    const newPosition = Math.floor(Math.random() * (maxPosition - minPosition + 1)) + minPosition;
    
    // Update safe zone position
    safeZone.css('left', newPosition + 'px');
    
    // Update safe zone boundaries
    safeZoneLeft = newPosition;
    safeZoneRight = newPosition + safeZoneWidth;
}

function startTimer() {
    timeRemaining = hackConfig.timeLimit;
    updateTimerDisplay();
    clearInterval(timerInterval);
    $('.timer-progress').css('width', '100%');
    timerInterval = setInterval(function() {
        timeRemaining -= 0.1;
        timeRemaining = Math.max(0, parseFloat(timeRemaining.toFixed(1)));
        
        // Update timer display
        updateTimerDisplay();
        
        // Update timer bar
        const percentage = (timeRemaining / hackConfig.timeLimit) * 100;
        $('.timer-progress').css('width', percentage + '%');
        
        // Check if time ran out
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            onFailure('Time expired!');
        }
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function updateTimerDisplay() {
    $('#timer-count').text(timeRemaining.toFixed(1));
}

// Fix the checkResult function to not play sounds directly
function checkResult() {
    // Immediately stop animation to reduce delay perception
    stopPulse();
    
    const currentPosition = $('.pulse-bar').position().left;
    const pulseRight = currentPosition + pulseWidth;
    
    // Update safe zone boundaries before checking
    safeZoneLeft = $('.safe-zone').position().left;
    safeZoneRight = safeZoneLeft + $('.safe-zone').width();
    
    // Check if pulse is within safe zone
    if (currentPosition >= safeZoneLeft && pulseRight <= safeZoneRight) {
        // Play click sound on success
        playSoundSafe('sound-click');
        onSuccess();
    } else {
        // Play failure sound
        playSoundSafe('sound-failure');
        onFailure('Hack failed - outside safe zone!');
    }
}

// Update onSuccess to play a different sound for stage completion vs. full hack completion
function onSuccess() {
    $('.pulse-bar').addClass('success-bar');
    successCount++;
    updateCounter();
    
    if (successCount >= hackConfig.requiredHacks) {
        stopTimer();
        $('#message').text('FIREWALL BYPASSED!');
        // Play success sound ONLY on final completion
        playSoundSafe('sound-success');
        
        // Send success message first, then fade out UI
        $.post('https://luma-minigames/hackSuccess', JSON.stringify({}));
        
        setTimeout(() => {
            $('#hack-container').fadeOut(500);
        }, 1000);
    } else {
        $('#message').text('SUCCESS! Difficulty increased.');
        // Shrink safe zone (with a minimum width)
        setTimeout(() => {
            $('.pulse-bar').removeClass('success-bar');
            
            // Shrink safe zone (with a minimum width)
            safeZoneWidth = Math.max(hackConfig.safeZoneMinWidth, safeZoneWidth - hackConfig.safeZoneShrinkAmount);
            $('.safe-zone').width(safeZoneWidth);
            // Increase speed (with max cap)
            repositionSafeZone();
            // Reset timer for next hack
            speed = Math.min(hackConfig.maxSpeed, speed + 1);
            
            // Start pulse again
            startTimer();
            startPulse();
        }, 1000);
    }
}

// Update onFailure to play the failure sound
function onFailure(reason) {
    stopTimer();
    $('.pulse-bar').addClass('fail-bar');
    $('#message').text(reason || 'BREACH FAILED! Security alerted.');
    // Play failure sound
    playSoundSafe('sound-failure');
    // Send failure message first, then fade out UI
    $.post('https://luma-minigames/hackFail', JSON.stringify({}));
    
    setTimeout(() => {
        $('#hack-container').fadeOut(500);
    }, 1000);
}

function updateCounter() {
    $('#counter').text(successCount);
}