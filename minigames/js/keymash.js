// Keymash game variables
let keymashActive = false;
let progress = 0;
let maxProgress = 100;
let decayRate = 2; // Progress lost per second when not pressing
let keyPressValue = 2; // Progress gained per key press
let lastPressTime = 0;
let decayInterval;
let targetKey = 'E'; // Default key
let keyCode = 69; // E key by default
let startTime = 0; // Track when the game started
let gracePeriod = 2000; // 2 seconds grace period before failure is possible
let keyPressedOnce = false; // Track if player has pressed the key at least once

// Setup the keymash game
function setupKeymash(config) {
    // Handle possible keys
    let possibleKeys = ['E']; // Default if not provided
    
    if (config?.possibleKeys && Array.isArray(config.possibleKeys) && config.possibleKeys.length > 0) {
        possibleKeys = config.possibleKeys;
    }
    
    // Randomly select a key from the possible keys
    targetKey = possibleKeys[Math.floor(Math.random() * possibleKeys.length)];
    
    // Map key names to key codes
    const keyCodeMap = {
        'E': 69,
        'SPACE': 32,
        'F': 70,
        'Q': 81,
        'R': 82,
        'T': 84,
        'Y': 89,
        'U': 85,
        'I': 73,
        'O': 79,
        'P': 80,
        'A': 65,
        'S': 83,
        'D': 68,
        'G': 71,
        'H': 72,
        'J': 74,
        'K': 75,
        'L': 76,
        'Z': 90,
        'X': 88,
        'C': 67,
        'V': 86,
        'B': 66,
        'N': 78,
        'M': 77,
        '1': 49,
        '2': 50,
        '3': 51,
        '4': 52,
        '5': 53,
        '6': 54,
        '7': 55,
        '8': 56,
        '9': 57,
        '0': 48
    };
    
    // Set the keycode based on the target key
    keyCode = keyCodeMap[targetKey] || 69; // Default to E if key not found
    
    // Set other parameters
    keyPressValue = config?.keyPressValue || 2;
    decayRate = config?.decayRate || 2;
    
    // Update UI
    $('#target-key').text(targetKey === 'SPACE' ? 'SPACE' : targetKey);
    
    // Reset progress
    resetKeymash();
    
    console.log("Keymash configured with target key:", targetKey, "keyCode:", keyCode);
}

// Reset the keymash game
function resetKeymash() {
    progress = 0; // Start with empty progress
    keyPressedOnce = false; // Reset key press tracking
    updateProgressDisplay();
    $('.progress-bar').removeClass('progress-flash');
}

// Start the keymash game
function startKeymash() {
    keymashActive = true;
    resetKeymash();
    
    // Record start time
    startTime = Date.now();
    
    // Start progress decay
    decayInterval = setInterval(decayProgress, 100);
    
    // Show UI
    $('#keymash-container').fadeIn(300);
    
    // Last press time (initialize to prevent immediate decay)
    lastPressTime = Date.now();
    
    console.log("Keymash game started with target key:", targetKey);
}

// Update the stopKeymash function
function stopKeymash(success) {
    if (!keymashActive) return; // Prevent multiple calls
    
    keymashActive = false;
    
    // Stop decay
    clearInterval(decayInterval);
    
    console.log("Keymash game stopped, success:", success);
    
    // Play sound
    if (typeof playSoundSafe === 'function') {
        playSoundSafe(success ? 'sound-success' : 'sound-failure');
    }
    
    // Apply appropriate flash effect
    if (success) {
        $('.progress-bar').addClass('progress-flash').css('stroke', 'var(--safe-zone)');
    } else {
        // Remove any existing classes first
        $('.progress-bar').removeClass('progress-flash');
        // Add red flash for failure
        $('.progress-bar').addClass('failure-flash').css('stroke', 'var(--danger-color)');
    }
    
    // Hide UI after delay
    setTimeout(() => {
        $('#keymash-container').fadeOut(300);
        
        // Reset the progress bar classes for next time
        $('.progress-bar').removeClass('progress-flash failure-flash').css('stroke', '');
        
        // Send result to FiveM
        $.post('https://luma-minigames/keymashResult', JSON.stringify({
            success: success
        }));
    }, 1500); // Increased delay to show the effect longer
}

// Handle a key press event from either source
function handleKeymashKeypress(keyCodeInput) {
    if (!keymashActive) return;
    
    console.log("Key pressed:", keyCodeInput, "Target key:", keyCode);
    
    // Check if it's the right key
    if (parseInt(keyCodeInput) === keyCode) {
        // Mark that key has been pressed at least once
        keyPressedOnce = true;
        
        // Update last press time
        lastPressTime = Date.now();
        
        // Add progress
        progress = Math.min(maxProgress, progress + keyPressValue);
        
        // Play click sound
        if (typeof playSoundSafe === 'function') {
            playSoundSafe('sound-click');
        }
        
        // Add active class briefly
        $('.key-display').addClass('active');
        setTimeout(() => $('.key-display').removeClass('active'), 100);
        
        // Update progress display
        updateProgressDisplay();
        
        // Add flashing when close to complete
        if (progress >= 85 && progress < 100) {
            $('.progress-bar').addClass('progress-flash');
        }
        
        // Check for completion
        if (progress >= maxProgress) {
            stopKeymash(true);
        }
    }
}

// Also update the decayProgress function to include the red flash when getting close to failure
function decayProgress() {
    if (!keymashActive) return;
    
    const now = Date.now();
    
    // Only decay if player has pressed the key at least once
    if (!keyPressedOnce) {
        return; // Skip decay until first key press
    }
    
    if (now - lastPressTime > 500) {
        // Decay progress
        progress = Math.max(0, progress - (decayRate / 10));
        
        // Update progress display
        updateProgressDisplay();
        
        // Flash effects based on progress
        if (progress < 20) {
            // Getting close to failure - add danger flash
            $('.progress-bar').removeClass('progress-flash');
            $('.progress-bar').css('stroke', 'var(--danger-color)');
        } else if (progress < 85) {
            // Normal range - remove all flashing
            $('.progress-bar').removeClass('progress-flash');
            $('.progress-bar').css('stroke', ''); // Reset to default color
        }
        
        // Check for failure - only if player has pressed the key at least once
        if (progress <= 0) {
            stopKeymash(false);
        }
    }
}

// Update the progress display
function updateProgressDisplay() {
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (progress / 100) * circumference;
    $('.progress-bar').css('stroke-dashoffset', offset);
}

// Debug function to detect if keys are being received
$(document).on('keydown', function(e) {
    if (keymashActive) {
        console.log("Direct keydown detected:", e.keyCode);
        handleKeymashKeypress(e.keyCode);
    }
});

// Export functions for external use
window.keymashFunctions = {
    setup: setupKeymash,
    start: startKeymash,
    stop: stopKeymash,
    handleKeypress: handleKeymashKeypress
};