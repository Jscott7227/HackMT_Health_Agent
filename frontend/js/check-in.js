// ==========================================
// BENJI CHECK-IN SYSTEM - FINAL VERSION
// Linear flow: Day → Goal 1 → Goal 2 → ... → Submit
// No tabs, just progress through screens
// ==========================================

// Global state
let currentScreen = 0;
let totalScreens = 1; // Day + number of goals
let userProfile = null;
let userGoals = []; // Full goal objects with descriptions

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  await initializeCheckIn();
  attachEventListeners();
});

async function initializeCheckIn() {
  try {
    // Load user profile and goals
    userProfile = await fetchUserProfile();
    userGoals = await fetchUserGoals();
    
    totalScreens = 1 + userGoals.length; // Day screen + one per goal
    
    console.log('Initialized with goals:', userGoals);
    
    // Build goal screens dynamically
    buildGoalScreens();
    
    // Initialize visibility
    updateScreenVisibility();
  } catch (error) {
    console.error('Error initializing check-in:', error);
  }
}

// ==========================================
// BUILD GOAL SCREENS
// ==========================================

function buildGoalScreens() {
  const formContainer = document.querySelector('.checkin-form');
  if (!formContainer) return;
  
  // Clear existing goal sections (keep day section)
  const existingGoalSections = formContainer.querySelectorAll('.domain-section:not(#domain-day)');
  existingGoalSections.forEach(section => section.remove());
  
  // Create a screen for each goal
  userGoals.forEach((goal, index) => {
    const section = document.createElement('div');
    section.className = 'domain-section';
    section.id = `domain-goal-${index}`;
    
    const goalType = goal.type || goal.goalType || 'general';
    const goalIcon = getGoalIcon(goalType);
    const combinedLine = [
      goal.description,
      goal.target,
      goal.timeline,
      goal.remaining
    ].filter(Boolean).join(' ');
    
    section.innerHTML = `
      <div class="section-intro">
        <div class="goal-header">
          <i class="${goalIcon}" style="font-size: 2rem; color: var(--forest-500); margin-bottom: 1rem;"></i>
          <h2 class="section-title">${goal.title || goal.name || 'Goal'}</h2>
        </div>
        <div class="goal-details">
          ${combinedLine ? `<p class="goal-description">${combinedLine}</p>` : ''}
          ${goal.measurable ? `<p class="goal-target"><strong>Target:</strong> ${goal.measurable}</p>` : ''}
          ${goal.timeline && !combinedLine.includes(goal.timeline) ? `<p class="goal-timeline"><strong>Timeline:</strong> ${goal.timeline}</p>` : ''}
          ${goal.remaining ? `<p class="goal-overall-progress"><strong>Remaining:</strong> ${goal.remaining}</p>` : ''}
        </div>
      </div>
      
      <div class="form-domain">
      <div class="form-group">
        <label class="form-label">How much progress did you make on this goal today? (1-5)</label>
        <div class="scale-input">
          <input type="range" min="0" max="5" value="2" id="goal-${index}-progress" class="range-slider" data-goal-index="${index}">
          <div class="scale-labels">
            <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
          </div>
        </div>
        <div class="value-readout">
          <span id="goal-${index}-progress-value">2</span>/5
        </div>
      </div>
        
        <div class="form-group">
          <label class="form-label">Notes about today's progress</label>
          <textarea 
            id="goal-${index}-notes" 
            class="text-area" 
            placeholder="What did you do today? Any challenges or wins?"
            rows="4"
            data-goal-index="${index}"
          ></textarea>
        </div>
      </div>
    `;
    
    formContainer.appendChild(section);
    
    // Attach range slider listener
    setTimeout(() => {
      const slider = document.getElementById(`goal-${index}-progress`);
      const display = document.getElementById(`goal-${index}-progress-value`);
      if (slider && display) {
        slider.addEventListener('input', (e) => {
          display.textContent = e.target.value;
        });
      }
    }, 0);
  });
}

function getGoalIcon(goalType) {
  const iconMap = {
    'weight-loss': 'fa-solid fa-weight-scale',
    'weight-gain': 'fa-solid fa-chart-line',
    'body-recomp': 'fa-solid fa-dumbbell',
    'strength': 'fa-solid fa-dumbbell',
    'cardio': 'fa-solid fa-heart-pulse',
    'general': 'fa-solid fa-person-walking',
    'mobility': 'fa-solid fa-spa',
    'flexibility': 'fa-solid fa-spa',
    'injury': 'fa-solid fa-heart-circle-plus',
    'rehab': 'fa-solid fa-notes-medical',
    'performance': 'fa-solid fa-medal',
    'sleep': 'fa-solid fa-bed',
    'nutrition': 'fa-solid fa-utensils',
    'wellness': 'fa-solid fa-heart',
    'mental-health': 'fa-solid fa-brain',
    'mindfulness': 'fa-solid fa-om',
    'default': 'fa-solid fa-bullseye'
  };
  
  return iconMap[goalType] || iconMap['default'];
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function attachEventListeners() {
  // Open/close modal
  const openBtn = document.getElementById('openCheckinBtn');
  const closeBtn = document.getElementById('closeCheckinBtn');
  const modal = document.getElementById('checkinModal');
  
  if (openBtn) openBtn.addEventListener('click', openCheckInModal);
  if (closeBtn) closeBtn.addEventListener('click', closeCheckInModal);
  
  // Close modal when clicking outside
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeCheckInModal();
      }
    });
  }
  
  // Navigation
  const prevBtn = document.getElementById('prevDomain');
  const nextBtn = document.getElementById('nextDomain');
  const submitBtn = document.getElementById('submitCheckin');
  const clearBtn = document.getElementById('clearTodayBtn');
  
  if (prevBtn) prevBtn.addEventListener('click', navigatePrevious);
  if (nextBtn) nextBtn.addEventListener('click', navigateNext);
  if (submitBtn) submitBtn.addEventListener('click', submitCheckIn);
  if (clearBtn) clearBtn.addEventListener('click', clearTodayCheckin);
  
  // Range sliders with live updates for Overall Day
  attachRangeSliderListeners();
}

function attachRangeSliderListeners() {
  const sliders = [
    { id: 'dayScore', displayId: 'dayScoreValue' },
    { id: 'eatScore', displayId: 'eatScoreValue' },
    { id: 'drinkScore', displayId: 'drinkScoreValue' },
    { id: 'sleepScore', displayId: 'sleepScoreValue' }
  ];
  
  sliders.forEach(({ id, displayId }) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(displayId);
    
    if (slider && display) {
      slider.addEventListener('input', (e) => {
        display.textContent = e.target.value;
      });
    }
  });
}

// Clear today's (latest) check-in for demo/reset
async function clearTodayCheckin() {
  const btn = document.getElementById('clearTodayBtn');
  if (btn) btn.disabled = true;
  try {
    const session = window.BenjiAPI?.getSession?.();
    if (session && session.user_id) {
      if (window.BenjiAPI?.deleteLatestCheckin) {
        await window.BenjiAPI.deleteLatestCheckin(session.user_id);
      } else {
        // Try a generic endpoint if available
        await fetch('/api/checkin/delete-latest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: session.user_id })
        });
      }
    }
    alert("Today's check-in cleared for demo. Reloading...");
    window.location.reload();
  } catch (err) {
    console.error('Clear check-in failed', err);
    alert('Could not clear the latest check-in. Please try again.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ==========================================
// MODAL CONTROL
// ==========================================

function openCheckInModal() {
  const modal = document.getElementById('checkinModal');
  if (!modal) return;
  
  // Reset to first screen
  currentScreen = 0;
  updateScreenVisibility();
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeCheckInModal() {
  const modal = document.getElementById('checkinModal');
  if (!modal) return;
  
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// ==========================================
// NAVIGATION
// ==========================================

function navigatePrevious() {
  if (currentScreen > 0) {
    currentScreen--;
    updateScreenVisibility();
  }
}

function navigateNext() {
  if (currentScreen < totalScreens - 1) {
    currentScreen++;
    updateScreenVisibility();
  }
}

function updateScreenVisibility() {
  const prevBtn = document.getElementById('prevDomain');
  const nextBtn = document.getElementById('nextDomain');
  const submitBtn = document.getElementById('submitCheckin');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  // Hide all sections
  document.querySelectorAll('.domain-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Show current section
  let currentSection;
  if (currentScreen === 0) {
    // Day screen
    currentSection = document.getElementById('domain-day');
  } else {
    // Goal screen
    currentSection = document.getElementById(`domain-goal-${currentScreen - 1}`);
  }
  
  if (currentSection) {
    currentSection.classList.add('active');
  }
  
  // Update navigation buttons
  if (prevBtn) prevBtn.disabled = currentScreen === 0;
  
  if (currentScreen === totalScreens - 1) {
    // Last screen - show submit button
    if (nextBtn) nextBtn.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'flex';
  } else {
    if (nextBtn) nextBtn.style.display = 'flex';
    if (submitBtn) submitBtn.style.display = 'none';
  }
  
  // Update progress bar
  const progress = ((currentScreen + 1) / totalScreens) * 100;
  if (progressFill) progressFill.style.width = `${progress}%`;
  
  // Update progress text
  if (progressText) {
    if (currentScreen === 0) {
      progressText.textContent = 'Overall Day';
    } else {
      const goalIndex = currentScreen - 1;
      const goalTitle = userGoals[goalIndex]?.title || userGoals[goalIndex]?.name || `Goal ${goalIndex + 1}`;
      progressText.textContent = goalTitle;
    }
  }
}

// ==========================================
// FORM SUBMISSION
// ==========================================

async function submitCheckIn() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  
  // Show loading overlay
  if (loadingOverlay) loadingOverlay.style.display = 'flex';
  
  try {
    // Collect all check-in data
    const checkInData = collectCheckInData();
    
    console.log('Submitting check-in data:', checkInData);
    
    // Submit to backend
    await submitCheckInData(checkInData);
    
    // Close modal
    closeCheckInModal();
    
    // Show success message
    showSuccessMessage();
    
    // Reload the page to show updated dashboard
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } catch (error) {
    console.error('Error submitting check-in:', error);
    alert('Error submitting check-in. Please try again.');
  } finally {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
  }
}

function showSuccessMessage() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: linear-gradient(135deg, var(--forest-500) 0%, var(--forest-600) 100%);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-family: var(--font-body);
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <i class="fa-solid fa-check-circle" style="font-size: 1.5rem;"></i>
    <div>
      <strong style="display: block; margin-bottom: 0.25rem;">Check-in completed!</strong>
      <span style="font-size: 0.875rem; opacity: 0.9;">Benji is analyzing your progress...</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function collectCheckInData() {
  const data = {
    UserID: userProfile?.userId || 'unknown',
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    
    // Overall Day data
    dayScore: parseInt(document.getElementById('dayScore')?.value || 7),
    dayNotes: document.getElementById('dayNotes')?.value || '',
    tags: Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(cb => cb.value),
    eatScore: parseInt(document.getElementById('eatScore')?.value || 3),
    drinkScore: parseInt(document.getElementById('drinkScore')?.value || 3),
    sleepScore: parseInt(document.getElementById('sleepScore')?.value || 3),
    
    // Goals progress
    goals: []
  };
  
    // Collect data for each goal
    userGoals.forEach((goal, index) => {
      const progressSlider = document.getElementById(`goal-${index}-progress`);
      const notesField = document.getElementById(`goal-${index}-notes`);
      
      data.goals.push({
        goalId: goal.id || goal.goalId || `goal-${index}`,
        goalTitle: goal.title || goal.name || '',
        goalType: goal.type || goal.goalType || '',
        progress: parseInt(progressSlider?.value || 0, 10),
        notes: notesField?.value || '',
        timestamp: new Date().toISOString()
      });
    });
  
  return data;
}

// ==========================================
// API CALLS
// ==========================================

async function fetchUserProfile() {
  try {
    if (window.mockAPI) {
      console.log('Using mock API for user profile');
      return await window.mockAPI.getUserProfile();
    }
    
    const response = await fetch('/api/user/profile', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
  }
  
  return {
    userId: '0JAbns4VXVE6GsEDluTM'
  };
}

async function fetchUserGoals() {
  // Preferred: BenjiAPI
  if (window.BenjiAPI && window.BenjiAPI.getSession && window.BenjiAPI.getGoals) {
    const session = window.BenjiAPI.getSession();
    if (session && session.user_id) {
      try {
        const data = await window.BenjiAPI.getGoals(session.user_id);
        const raw = Array.isArray(data) ? data : (data?.goals || data?.accepted || []);
        return normalizeGoals(raw);
      } catch (err) {
        console.error('BenjiAPI goals fetch failed', err);
      }
    }
  }

  // Fallback: local API
  try {
    const response = await fetch('/api/user/goals', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
      const data = await response.json();
      const raw = Array.isArray(data) ? data : (data?.goals || data?.accepted || []);
      return normalizeGoals(raw);
    }
  } catch (error) {
    console.error('Error fetching user goals:', error);
  }
  
  return normalizeGoals([]);
}

function normalizeGoals(rawGoals) {
  if (!Array.isArray(rawGoals)) return [];
  return rawGoals.map((g, idx) => {
    // Support both string and object
    if (typeof g === 'string') {
      return {
        id: g,
        title: g,
        description: '',
        target: '',
        timeline: '',
        remaining: ''
      };
    }
    return {
      id: g.id || g.ID || g._id || g.goalId || `goal-${idx}`,
      title: g.title || g.name || g.Description || g.Specific || 'Goal',
      description: g.description || g.Description || '',
      target: g.target || g.Measurable || g.measurable || '',
      measurable: g.Measurable || g.measurable || '',
      timeline: g.timeline || g.Time_Bound || g.timebound || g.goalLength || g.length || '',
      remaining: g.remaining || g.Progress || g.progress || '',
      type: g.type || g.goalType || g.Category || g.category || 'general'
    };
  });
}

async function submitCheckInData(checkInData) {
  // Preferred: BenjiAPI
  if (window.BenjiAPI && window.BenjiAPI.postCheckin && window.BenjiAPI.getSession) {
    const session = window.BenjiAPI.getSession();
    if (session && session.user_id) {
      return window.BenjiAPI.postCheckin(Object.assign({ user_id: session.user_id }, checkInData));
    }
  }

  // Fallback: local endpoint
  const response = await fetch('/api/checkin/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checkInData)
  });
  
  if (!response.ok) {
    throw new Error('Failed to submit check-in');
  }
  
  return await response.json();
}
