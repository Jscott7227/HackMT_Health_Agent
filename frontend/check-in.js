/**
 * Check-in Page Script
 * Handles domain-based tabbed navigation and form submission
 */

// State management
const CheckInState = {
    currentDomain: 'physical',
    domains: ['physical', 'mental', 'spiritual', 'nutrition', 'planning', 'workload', 'environment', 'progress'],
    currentIndex: 0,
    formData: {},
    completedDomains: new Set()
};

// =====================================
// Initialization
// =====================================

document.addEventListener('DOMContentLoaded', function() {
    initializeCheckIn();
});

function initializeCheckIn() {
    // Set current date
    updateCurrentDate();
    
    // Initialize domain navigation
    initializeDomainTabs();
    
    // Initialize form controls
    initializeFormControls();
    
    // Initialize navigation buttons
    initializeNavigationButtons();
    
    // Initialize form submission
    initializeFormSubmission();
    
    // Update progress
    updateProgress();
    
    // Check for API key
    checkApiKey();
}

// =====================================
// Date & Time
// =====================================

function updateCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = now.toLocaleDateString('en-US', options);
}

// =====================================
// Domain Navigation
// =====================================

function initializeDomainTabs() {
    const domainTabs = document.querySelectorAll('.nav-tab[data-domain]');
    
    domainTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const domainId = this.dataset.domain;
            const index = CheckInState.domains.indexOf(domainId);
            
            if (index !== -1) {
                navigateToDomain(index);
            }
        });
    });
}

function navigateToDomain(index) {
    // Validate index
    if (index < 0 || index >= CheckInState.domains.length) return;
    
    const domainId = CheckInState.domains[index];
    
    // Update state
    CheckInState.currentIndex = index;
    CheckInState.currentDomain = domainId;
    
    // Update active tab
    document.querySelectorAll('.nav-tab[data-domain]').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.nav-tab[data-domain="${domainId}"]`).classList.add('active');
    
    // Update active section
    document.querySelectorAll('.domain-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`domain-${domainId}`).classList.add('active');
    
    // Update navigation buttons
    updateNavigationButtons();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initializeNavigationButtons() {
    const prevBtn = document.getElementById('prevDomain');
    const nextBtn = document.getElementById('nextDomain');
    
    prevBtn.addEventListener('click', function() {
        if (CheckInState.currentIndex > 0) {
            navigateToDomain(CheckInState.currentIndex - 1);
        }
    });
    
    nextBtn.addEventListener('click', function() {
        if (CheckInState.currentIndex < CheckInState.domains.length - 1) {
            markDomainAsVisited();
            navigateToDomain(CheckInState.currentIndex + 1);
        }
    });
}

function updateNavigationButtons() {
    const prevBtn = document.getElementById('prevDomain');
    const nextBtn = document.getElementById('nextDomain');
    const submitBtn = document.getElementById('submitCheckin');
    
    // Update previous button
    prevBtn.disabled = CheckInState.currentIndex === 0;
    
    // Update next/submit button
    if (CheckInState.currentIndex === CheckInState.domains.length - 1) {
        // Last domain - show submit button
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'inline-flex';
    } else {
        // Not last domain - show next button
        nextBtn.style.display = 'flex';
        submitBtn.style.display = 'none';
    }
}

function markDomainAsVisited() {
    CheckInState.completedDomains.add(CheckInState.currentDomain);
    updateProgress();
}

function updateProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    const totalDomains = CheckInState.domains.length;
    const currentIndex = CheckInState.currentIndex;
    
    // Calculate progress (current position through domains)
    const progressPercent = ((currentIndex + 1) / totalDomains) * 100;
    
    progressFill.style.width = `${progressPercent}%`;
    
    // Update text
    const domainNames = {
        'physical': 'Physical',
        'mental': 'Mental & Emotional',
        'spiritual': 'Spirit & Purpose',
        'nutrition': 'Nutrition',
        'planning': 'Time & Planning',
        'workload': 'Mental Load',
        'environment': 'Environment',
        'progress': 'Progress & Growth'
    };
    
    const currentName = domainNames[CheckInState.currentDomain];
    progressText.textContent = `${currentName} (${currentIndex + 1}/${totalDomains})`;
}

// =====================================
// Form Controls
// =====================================

function initializeFormControls() {
    // Button groups (radio-like behavior)
    const optionButtons = document.querySelectorAll('.option-btn');
    optionButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const group = this.dataset.group;
            
            // Deactivate other buttons in the same group
            document.querySelectorAll(`[data-group="${group}"]`).forEach(b => {
                b.classList.remove('active');
            });
            
            // Activate this button
            this.classList.add('active');
        });
    });
    
    // Emoji buttons (mood)
    const emojiButtons = document.querySelectorAll('.emoji-btn');
    emojiButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const group = this.dataset.group;
            
            // Deactivate other emojis in the same group
            document.querySelectorAll(`[data-group="${group}"]`).forEach(b => {
                b.classList.remove('active');
            });
            
            // Activate this emoji
            this.classList.add('active');
        });
    });
    
    // Habit buttons
    const habitButtons = document.querySelectorAll('.habit-btn');
    habitButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const habit = this.dataset.habit;
            
            // Deactivate other buttons for this habit
            document.querySelectorAll(`[data-habit="${habit}"]`).forEach(b => {
                b.classList.remove('active');
            });
            
            // Activate this button
            this.classList.add('active');
        });
    });
}

// =====================================
// Form Data Collection
// =====================================

function collectFormData() {
    const formData = {};
    
    // Physical health
    formData.physical = {
        energyLevel: parseInt(document.getElementById('energyLevel').value),
        soreness: getActiveButtonValue('soreness'),
        pain: getCheckedValues('pain'),
        sleepQuality: parseInt(document.getElementById('sleepQuality').value),
        bedtime: document.getElementById('bedtime').value,
        waketime: document.getElementById('waketime').value,
        healthStatus: getCheckedValues('health-status')
    };
    
    // Mental & Emotional
    formData.mental = {
        mood: getActiveButtonValue('mood'),
        stressLevel: parseInt(document.getElementById('stressLevel').value),
        mentalState: getCheckedValues('mental-state'),
        reflection: document.getElementById('reflection').value,
        weighing: document.getElementById('weighing').value
    };
    
    // Spiritual & Meaning
    formData.spiritual = {
        intention: document.getElementById('intention').value,
        gratitude: document.getElementById('gratitude').value,
        alignment: getActiveButtonValue('alignment')
    };
    
    // Nutrition
    formData.nutrition = {
        meals: document.getElementById('meals').value,
        satisfaction: parseInt(document.getElementById('satisfaction').value),
        eatingContext: getCheckedValues('eating-context'),
        cravings: document.getElementById('cravings').value
    };
    
    // Time & Energy Planning
    formData.planning = {
        timeBlocks: document.getElementById('timeBlocks').value,
        energyForecast: getActiveButtonValue('energy-forecast'),
        priorities: [
            document.getElementById('priority1').value,
            document.getElementById('priority2').value,
            document.getElementById('priority3').value
        ],
        mustNice: document.getElementById('mustNice').value
    };
    
    // Work/Study Load
    formData.workload = {
        cognitiveLoad: parseInt(document.getElementById('cognitiveLoad').value),
        deadlines: document.getElementById('deadlines').value,
        focusDifficulty: getActiveButtonValue('focus'),
        contextSwitching: getActiveButtonValue('switching')
    };
    
    // Environment
    formData.environment = {
        location: getActiveButtonValue('location'),
        noiseLevel: getActiveButtonValue('noise'),
        spaceCondition: getActiveButtonValue('space'),
        digitalOverwhelm: getCheckedValues('digital')
    };
    
    // Goals & Habits
    formData.progress = {
        optimizing: document.getElementById('optimizing').value,
        habits: {
            morning: getActiveHabitStatus('morning'),
            movement: getActiveHabitStatus('movement'),
            mindfulness: getActiveHabitStatus('mindfulness')
        }
    };
    
    return formData;
}

function getActiveButtonValue(group) {
    const activeBtn = document.querySelector(`[data-group="${group}"].active`);
    return activeBtn ? activeBtn.dataset.value : null;
}

function getCheckedValues(name) {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
}

function getActiveHabitStatus(habit) {
    const activeBtn = document.querySelector(`[data-habit="${habit}"].active`);
    return activeBtn ? activeBtn.dataset.status : null;
}

// =====================================
// Form Submission
// =====================================

function initializeFormSubmission() {
    const submitBtn = document.getElementById('submitCheckin');
    
    submitBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        
        // Mark final domain as visited
        markDomainAsVisited();
        
        // Collect form data
        const formData = collectFormData();
        
        // Show loading
        showLoading();
        
        try {
            // Save check-in to storage
            const savedCheckIn = await window.WellnessStorage.saveCheckIn(formData);
            
            if (!savedCheckIn) {
                throw new Error('Failed to save check-in');
            }
            
            // Get AI response
            const aiResponse = await window.WellnessAgent.processCheckIn(formData);
            
            if (aiResponse.success) {
                // Display AI response
                displayAgentMessage(aiResponse.message);
                
                // Save the AI response as an insight
                await window.WellnessStorage.saveInsight({
                    type: 'checkin-response',
                    checkInId: savedCheckIn.id,
                    message: aiResponse.message
                });
                
                // Reset form and state
                resetCheckIn();
                
                // Scroll to top to see response
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                displayAgentMessage(aiResponse.message);
            }
            
        } catch (error) {
            console.error('Error submitting check-in:', error);
            displayAgentMessage(`Something went wrong: ${error.message}. Your check-in was saved, but I couldn't generate a response.`);
        } finally {
            hideLoading();
        }
    });
}

function resetCheckIn() {
    // Reset to first domain
    navigateToDomain(0);
    
    // Clear completed domains
    CheckInState.completedDomains.clear();
    
    // Reset form values
    const form = document.getElementById('checkinForm');
    
    // Reset range sliders to middle value
    document.querySelectorAll('.range-slider').forEach(slider => {
        slider.value = 3;
    });
    
    // Reset text inputs and textareas
    document.querySelectorAll('.text-input, .text-area').forEach(input => {
        input.value = '';
    });
    
    // Reset time inputs
    document.querySelectorAll('.time-input').forEach(input => {
        input.value = '';
    });
    
    // Reset checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    
    // Reset button groups to default
    document.querySelectorAll('.option-btn, .emoji-btn, .habit-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Set default active states
    document.querySelector('[data-group="soreness"][data-value="none"]')?.classList.add('active');
    document.querySelector('[data-group="mood"][data-value="3"]')?.classList.add('active');
    document.querySelector('[data-group="alignment"][data-value="somewhat"]')?.classList.add('active');
    document.querySelector('[data-group="energy-forecast"][data-value="medium"]')?.classList.add('active');
    document.querySelector('[data-group="focus"][data-value="moderate"]')?.classList.add('active');
    document.querySelector('[data-group="switching"][data-value="moderate"]')?.classList.add('active');
    document.querySelector('[data-group="location"][data-value="home"]')?.classList.add('active');
    document.querySelector('[data-group="noise"][data-value="quiet"]')?.classList.add('active');
    document.querySelector('[data-group="space"][data-value="lived-in"]')?.classList.add('active');
    
    // Update progress
    updateProgress();
}

// =====================================
// Agent Message Display
// =====================================

function displayAgentMessage(message) {
    const messageElement = document.getElementById('agentMessage');
    
    // Add fade out effect
    messageElement.style.opacity = '0';
    
    setTimeout(() => {
        // Update message
        messageElement.innerHTML = `<p>${message.replace(/\n/g, '</p><p>')}</p>`;
        
        // Fade in
        messageElement.style.transition = 'opacity 0.5s ease';
        messageElement.style.opacity = '1';
    }, 300);
}

// =====================================
// Loading State
// =====================================

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('active');
}

// =====================================
// API Key Check
// =====================================

function checkApiKey() {
    const apiKey = window.WellnessStorage.getApiKey();
    
    if (!apiKey) {
        displayAgentMessage(
            'Welcome to Benji! To get started, please add your Anthropic API key in Settings. ' +
            'This allows me to provide personalized, thoughtful responses to your check-ins.'
        );
    }
}
