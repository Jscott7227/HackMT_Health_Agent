// ==========================================
// AI-DRIVEN CHECK-IN SYSTEM FOR BENJI
// ==========================================

// Global state
let currentDomain = 0;
let domains = ['day', 'goals'];
let userProfile = null;
let activeGoals = [];

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
  await initializeCheckIn();
  attachEventListeners();
});

async function initializeCheckIn() {
  try {
    // Load active goals from backend
    const goals = await fetchUserGoals();
        
    // Update domain list based on active goals
    if (activeGoals.length > 0) {
      domains = ['day', 'goals'];
      // Show goals tab
      const goalsTab = document.querySelector('[data-domain="goals"]');
      if (goalsTab) goalsTab.style.display = 'flex';
    } else {
      domains = ['day'];
      // Hide goals tab
      const goalsTab = document.querySelector('[data-domain="goals"]');
      if (goalsTab) goalsTab.style.display = 'none';
    }
    
    // Initialize the check-in modal structure
    updateDomainVisibility();
  } catch (error) {
    console.error('Error initializing check-in:', error);
  }
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
  
  if (prevBtn) prevBtn.addEventListener('click', navigatePrevious);
  if (nextBtn) nextBtn.addEventListener('click', navigateNext);
  if (submitBtn) submitBtn.addEventListener('click', submitCheckIn);
  
  // Tab navigation
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const domain = tab.getAttribute('data-domain');
      const domainIndex = domains.indexOf(domain);
      if (domainIndex !== -1) {
        currentDomain = domainIndex;
        updateDomainVisibility();
      }
    });
  });
  
  // Range sliders with live updates
  attachRangeSliderListeners();

  // Goal toggle buttons (yes/no)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-goal-toggle] .option-btn');
    if (!btn) return;
    const group = btn.closest('[data-goal-toggle]');
    group.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
}

function attachRangeSliderListeners() {
  const sliders = [
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

// ==========================================
// MODAL CONTROL
// ==========================================

async function openCheckInModal() {
  const modal = document.getElementById('checkinModal');
  if (!modal) return;
  
  // Reset to first domain
  currentDomain = 0;
  updateDomainVisibility();
  
  // Load AI-generated questions for goals if user has active goals
  await loadGoalsIntoForm();
  
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
  if (currentDomain > 0) {
    currentDomain--;
    updateDomainVisibility();
  }
}

function navigateNext() {
  if (currentDomain < domains.length - 1) {
    currentDomain++;
    updateDomainVisibility();
  }
}

function updateDomainVisibility() {
  const prevBtn = document.getElementById('prevDomain');
  const nextBtn = document.getElementById('nextDomain');
  const submitBtn = document.getElementById('submitCheckin');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  // Hide all domain sections
  document.querySelectorAll('.domain-section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Show current domain
  const currentDomainName = domains[currentDomain];
  const currentSection = document.getElementById(`domain-${currentDomainName}`);
  if (currentSection) {
    currentSection.classList.add('active');
  }
  
  // Update navigation buttons
  if (prevBtn) prevBtn.disabled = currentDomain === 0;
  
  if (currentDomain === domains.length - 1) {
    if (nextBtn) nextBtn.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'flex';
  } else {
    if (nextBtn) nextBtn.style.display = 'flex';
    if (submitBtn) submitBtn.style.display = 'none';
  }
  
  // Update progress bar
  const progress = ((currentDomain + 1) / domains.length) * 100;
  if (progressFill) progressFill.style.width = `${progress}%`;
  
  // Update progress text
  const domainLabels = {
    'day': 'Daily Check-in',
    'goals': 'Goals'
  };
  if (progressText) {
    progressText.textContent = domainLabels[currentDomainName] || currentDomainName;
  }
  
  // Update tab navigation highlighting
  updateTabHighlighting(currentDomainName);
}

function updateTabHighlighting(domainName) {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('active');
    if (tab.getAttribute('data-domain') === domainName) {
      tab.classList.add('active');
    }
  });
}

// ==========================================
// AI RECOMMENDATIONS
// ==========================================

// ==========================================
// Goals UI will be populated directly from API without AI questions.

// ==========================================

function generateScaleLabels(min, max) {
  const count = 5;
  const step = (max - min) / (count - 1);
  const labels = [];
  
  for (let i = 0; i < count; i++) {
    labels.push(`<span>${Math.round(min + step * i)}</span>`);
  }
  
  return labels.join('');
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
  // Create success notification
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
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Remove after 3 seconds
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
    dayNotes: document.getElementById('dayNotes')?.value || '',
    tags: Array.from(document.querySelectorAll('input[name="tags"]:checked')).map(cb => cb.value),
    eatScore: parseInt(document.getElementById('eatScore')?.value || 3),
    drinkScore: parseInt(document.getElementById('drinkScore')?.value || 3),
    sleepScore: parseInt(document.getElementById('sleepScore')?.value || 3),
    benjiContext: document.getElementById('benjiContextInput')?.value || '',
    goalResponses: collectGoalResponses(),
  };
  return data;
}

function collectGoalData() {
  const goalData = {};
  
  // Initialize all goal structures
  goalData.weightLoss = { calories: 0, trainingType: null, weight: 0 };
  goalData.weightGain = { calories: 0, weight: 0 };
  goalData.bodyRecomp = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, hydration: 0, weight: 0 };
  goalData.strength = { calories: 0, protein: 0, carbs: 0, fat: 0, hydration: 0, weight: 0 };
  goalData.cardio = { activityType: null, distance: 0, intensity: 3, pace: '', volume: 0 };
  goalData.general = { activity: '', method: null, weight: 0 };
  goalData.mobility = { sessions: 0, tightness: 3, stiffness: 3, soreness: 3, looseness: 3, painLevel: 1, painLocation: '', romNotes: '' };
  goalData.injury = { painIntensity: 3, painLocation: '', painType: null, painFrequency: null, stiffness: 3, functionScore: 3, activityTolerance: 0 };
  goalData.rehab = { trainingMinutes: 0, sessions: 0, afterEffects: 3, flareup: false, flareupDescription: '', flareupTriggers: [] };
  goalData.performance = { minutesTrained: 0, intensity: 3, difficulty: 3, soreness: 3, fatigue: 3 };
  goalData.menstrual = { cycleDay: 0, flow: null, crampPain: 0, symptoms: [], discharge: null, dischargeNotes: '', oralContraceptives: false, ocpType: '', lastPeriodStart: '' };
  
  activeGoals.forEach(goal => {
    const questions = aiGeneratedQuestions[goal];
    if (!questions) return;
    
    // Map goal names to data structure keys
    const goalKeyMap = {
      'weight-loss': 'weightLoss',
      'weight-gain': 'weightGain',
      'body-recomp': 'bodyRecomp',
      'strength': 'strength',
      'cardio': 'cardio',
      'general': 'general',
      'mobility': 'mobility',
      'injury': 'injury',
      'rehab': 'rehab',
      'performance': 'performance'
    };
    
    const goalKey = goalKeyMap[goal];
    if (!goalKey) return;
    
    // Find all inputs for this goal
    const inputs = document.querySelectorAll(`[data-goal="${goal}"]`);
    inputs.forEach(input => {
      const field = input.getAttribute('data-field');
      if (!field) return;
      
      let value;
      if (input.type === 'checkbox') {
        value = input.checked;
      } else if (input.type === 'number' || input.type === 'range') {
        value = parseFloat(input.value) || 0;
      } else {
        value = input.value || '';
      }
      
      // Handle nested fields (e.g., "nutrition.calories")
      const fieldParts = field.split('.');
      if (fieldParts.length > 1) {
        // For multi-field inputs, we need to ensure the parent object exists
        const parentField = fieldParts[0];
        const childField = fieldParts[1];
        
        if (!goalData[goalKey][parentField]) {
          goalData[goalKey][parentField] = {};
        }
        goalData[goalKey][parentField][childField] = value;
      } else {
        goalData[goalKey][field] = value;
      }
    });
  });
  
  return goalData;
}

// ==========================================
// API CALLS
// ==========================================

async function submitCheckInData(checkInData) {
  const session = window.BenjiAPI?.getSession?.();
  if (session && session.user_id && window.BenjiAPI?.postCheckin) {
    const payload = Object.assign({ user_id: session.user_id }, checkInData);
    return window.BenjiAPI.postCheckin(payload);
  }
  // Fallback: save locally so UI doesn't break if signed-out
  const key = 'Benji_checkins_local';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push(checkInData);
  localStorage.setItem(key, JSON.stringify(arr));
  return { saved: true, local: true };
}


// Goals rendering (simple)
async function loadGoalsIntoForm() {
  const container = document.getElementById('goalQuestionContainer');
  if (!container) return;
  if (!window.BenjiAPI || !window.BenjiAPI.getSession) {
    container.innerHTML = '<p class="form-note">Connect to Benji to load goals.</p>';
    return;
  }
  const session = window.BenjiAPI.getSession();
  if (!session || !session.user_id) {
    container.innerHTML = '<p class="form-note">Sign in to update goals.</p>';
    return;
  }
  container.innerHTML = '<div class="loading-spinner" style="margin: 1.5rem auto;"></div>';
  try {
    const data = await window.BenjiAPI.getGoals(session.user_id);
    const accepted = data && data.accepted != null ? data.accepted : (data?.goals || data || []);
    const goals = Array.isArray(accepted) ? accepted : []
    activeGoals = goals;
    activeGoals = goals;
    if (!goals.length) {
      container.innerHTML = '<p class="form-note" style="text-align:center;">No goals yet. Visit the <a href="goals.html">Goals page</a> to add some.</p>';
      return;
    }
    container.innerHTML = goals.map((g, idx) => {
      const label = g.Description || g.Specific || g.Specifics || `Goal ${idx+1}`;
      const id = g.id || g.ID || g._id || `goal_${idx}`;
      const measurable = g.Measurable || '';
      return `
        <div class="goal-card" data-goal-id="${id}">
          <div class="domain-header" style="margin-bottom:8px;">
            <h3 class="domain-title" style="margin:0;">${label}</h3>
            ${g.Time_Bound ? `<p class="checkin-hint" style="margin:4px 0 0 0;">${g.Time_Bound}</p>` : ''}
            ${measurable ? `<p class="checkin-hint" style="margin:2px 0 0 0;">${measurable}</p>` : ''}
          </div>
          <div class="form-group">
            <label class="form-label">Did you work on this today?</label>
            <div class="button-group" data-goal-toggle="${id}">
              <button type="button" class="option-btn" data-value="yes">Yes</button>
              <button type="button" class="option-btn active" data-value="no">No</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">What did you do / measure?</label>
            <input type="text" class="text-input" data-goal-progress="${id}" placeholder="e.g. 7.0 hrs sleep, 3x10 squats, 2,000 kcal" />
          </div>
          <div class="form-group">
            <label class="form-label">Notes (optional)</label>
            <textarea class="text-area" data-goal-notes="${id}" rows="2" placeholder="Any details or obstacles"></textarea>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.error('goal load error', err);
    container.innerHTML = '<p class="form-note">Unable to load goals right now.</p>';
  }
}

function collectGoalResponses() {
  const cards = Array.from(document.querySelectorAll('.goal-card'));
  return cards.map(card => {
    const id = card.getAttribute('data-goal-id');
    const toggle = card.querySelector('[data-goal-toggle] .option-btn.active');
    const completed = toggle ? toggle.dataset.value === 'yes' : false;
    const progress = card.querySelector('[data-goal-progress]')?.value?.trim() || '';
    const notes = card.querySelector('[data-goal-notes]')?.value?.trim() || '';
    return { goalId: id, completed, progress, notes };
  });
}

// Fetch goals from backend
async function fetchUserGoals() {
  const session = window.BenjiAPI?.getSession?.();
  if (!session || !session.user_id) return [];
  try {
    const data = await window.BenjiAPI.getGoals(session.user_id);
    const accepted = data && data.accepted != null ? data.accepted : (data?.goals || data || []);
    const goals = Array.isArray(accepted) ? accepted : [];
    return goals.map((g, idx) => g.id || g.ID || g._id || g.Description || `goal_${idx}`);
  } catch (err) {
    console.error('Failed to fetch goals', err);
    return [];
  }
}
