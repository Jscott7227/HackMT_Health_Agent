/**
 * Main Application Script
 * Handles all UI interactions and orchestrates the app
 */

// State management
const AppState = {
    currentSection: 'checkin',
    formData: {},
    isLoading: false
};

// =====================================
// Initialization
// =====================================

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Set current date
    updateCurrentDate();
    
    // Initialize navigation
    initializeNavigation();
    
    // Initialize form interactions
    initializeFormControls();
    
    // Initialize form submission
    initializeFormSubmission();
    
    // Initialize settings
    initializeSettings();
    
    // Load existing data
    loadJournalEntries();
    loadInsights();
    
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
// Navigation
// =====================================

function initializeNavigation() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const contentSections = document.querySelectorAll('.content-section');
    
    navTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const sectionId = this.dataset.section;
            
            // Update active tab
            navTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Update active section
            contentSections.forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
            
            AppState.currentSection = sectionId;
            
            // Refresh data if needed
            if (sectionId === 'journal') {
                loadJournalEntries();
            } else if (sectionId === 'insights') {
                loadInsights();
            }
        });
    });
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
    const form = document.getElementById('checkinForm');
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
    const form = document.getElementById('checkinForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (AppState.isLoading) return;
        
        // Collect form data
        const formData = collectFormData();
        
        // Show loading
        showLoading();
        AppState.isLoading = true;
        
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
                
                // Optionally save the AI response as an insight
                await window.WellnessStorage.saveInsight({
                    type: 'checkin-response',
                    checkInId: savedCheckIn.id,
                    message: aiResponse.message
                });
                
                // Reset form
                resetForm();
                
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
            AppState.isLoading = false;
        }
    });
}

function resetForm() {
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
// Journal Entries
// =====================================

async function loadJournalEntries() {
    const container = document.getElementById('journalContainer');
    
    try {
        const checkIns = await window.WellnessStorage.getAllCheckIns();
        
        if (checkIns.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📖</div>
                    <p>Your journal entries will appear here once you complete check-ins</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        checkIns.forEach(checkIn => {
            const entryElement = createJournalEntry(checkIn);
            container.appendChild(entryElement);
        });
        
    } catch (error) {
        console.error('Error loading journal entries:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>Error loading journal entries</p>
            </div>
        `;
    }
}

function createJournalEntry(checkIn) {
    const entry = document.createElement('div');
    entry.className = 'journal-entry';
    
    const date = new Date(checkIn.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Build summary
    const summary = [];
    
    if (checkIn.spiritual?.intention) {
        summary.push(`<strong>Intention:</strong> ${checkIn.spiritual.intention}`);
    }
    
    if (checkIn.spiritual?.gratitude) {
        summary.push(`<strong>Gratitude:</strong> ${checkIn.spiritual.gratitude}`);
    }
    
    if (checkIn.mental?.reflection) {
        summary.push(`<strong>Reflection:</strong> ${checkIn.mental.reflection}`);
    }
    
    const energyLabels = ['Drained', 'Low', 'Okay', 'Good', 'Vibrant'];
    if (checkIn.physical?.energyLevel) {
        summary.push(`<strong>Energy:</strong> ${energyLabels[checkIn.physical.energyLevel - 1]}`);
    }
    
    const moodEmojis = ['😞', '😕', '😐', '🙂', '😊'];
    if (checkIn.mental?.mood) {
        summary.push(`<strong>Mood:</strong> ${moodEmojis[checkIn.mental.mood - 1]}`);
    }
    
    entry.innerHTML = `
        <div class="entry-header">
            <div class="entry-date">${dateStr}</div>
        </div>
        <div class="entry-content">
            ${summary.join('<br>')}
        </div>
    `;
    
    return entry;
}

// =====================================
// Insights
// =====================================

async function loadInsights() {
    const container = document.getElementById('insightsContainer');
    
    try {
        const insights = await window.WellnessStorage.getAllInsights();
        
        if (insights.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🌙</div>
                    <p>Insights will emerge as patterns develop over time</p>
                    <button class="secondary-btn" onclick="generateNewInsights()" style="margin-top: 1rem;">
                        Generate Weekly Insights
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        // Add button to generate new insights
        const buttonDiv = document.createElement('div');
        buttonDiv.style.marginBottom = 'var(--space-lg)';
        buttonDiv.innerHTML = `
            <button class="secondary-btn" onclick="generateNewInsights()">
                Generate New Insights
            </button>
        `;
        container.appendChild(buttonDiv);
        
        insights.forEach(insight => {
            const insightElement = createInsightCard(insight);
            container.appendChild(insightElement);
        });
        
    } catch (error) {
        console.error('Error loading insights:', error);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>Error loading insights</p>
            </div>
        `;
    }
}

function createInsightCard(insight) {
    const card = document.createElement('div');
    card.className = 'insight-card';
    
    const date = new Date(insight.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    card.innerHTML = `
        <div class="insight-title">Insights from ${dateStr}</div>
        <div class="insight-content">
            ${insight.message.replace(/\n/g, '<br>')}
        </div>
    `;
    
    return card;
}

async function generateNewInsights() {
    showLoading();
    
    try {
        const result = await window.WellnessAgent.generateWeeklyInsights();
        
        if (result.success) {
            // Save the insights
            await window.WellnessStorage.saveInsight({
                type: 'weekly-insights',
                message: result.insights
            });
            
            // Reload insights display
            await loadInsights();
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error generating insights:', error);
        alert('Error generating insights: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Make generateNewInsights available globally
window.generateNewInsights = generateNewInsights;

// =====================================
// Settings
// =====================================

function initializeSettings() {
    // Load API key
    const apiKeyInput = document.getElementById('apiKey');
    apiKeyInput.value = window.WellnessStorage.getApiKey();
    
    // Save API key button
    document.getElementById('saveApiKey').addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }
        
        if (window.WellnessStorage.saveApiKey(apiKey)) {
            alert('API key saved successfully!');
        } else {
            alert('Error saving API key');
        }
    });
    
    // Export data button
    document.getElementById('exportData').addEventListener('click', async function() {
        try {
            const data = await window.WellnessStorage.exportData();
            
            if (!data) {
                alert('Error exporting data');
                return;
            }
            
            // Create download
            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `Benji-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
        } catch (error) {
            console.error('Error exporting data:', error);
            alert('Error exporting data: ' + error.message);
        }
    });
    
    // Clear data button
    document.getElementById('clearData').addEventListener('click', async function() {
        const confirmed = confirm(
            'Are you sure you want to clear all data? This cannot be undone.\n\n' +
            'Consider exporting your data first.'
        );
        
        if (!confirmed) return;
        
        const doubleConfirm = confirm(
            'This will permanently delete all your check-ins and insights. Are you absolutely sure?'
        );
        
        if (!doubleConfirm) return;
        
        showLoading();
        
        try {
            const success = await window.WellnessStorage.clearAllData();
            
            if (success) {
                alert('All data cleared successfully');
                
                // Reload the page to reset everything
                window.location.reload();
            } else {
                alert('Error clearing data');
            }
        } catch (error) {
            console.error('Error clearing data:', error);
            alert('Error clearing data: ' + error.message);
        } finally {
            hideLoading();
        }
    });
}

function checkApiKey() {
    const apiKey = window.WellnessStorage.getApiKey();
    
    if (!apiKey) {
        displayAgentMessage(
            'Welcome to Benji! To get started, please add your Anthropic API key in Settings. ' +
            'This allows me to provide personalized, thoughtful responses to your check-ins.'
        );
    }
}

// =====================================
// Utility Functions
// =====================================

// Add smooth scrolling for better UX
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});
