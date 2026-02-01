// ==========================================
// AI-DRIVEN CHECK-IN SYSTEM FOR BENJI
// ==========================================

// Global state
let currentDomain = 0;
let domains = ['day']; // domain slugs; 'day' is always first
let userProfile = null;
let activeGoals = [];
const LAST_GOALS_KEY = 'Benji_last_goals';

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
    activeGoals = await fetchUserGoals();

    // Build tabs/sections from goals
    rebuildDomains();
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
  document.getElementById('checkinTabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-tab');
    if (!tab) return;
    const domain = tab.getAttribute('data-domain');
    const domainIndex = domains.indexOf(domain);
    if (domainIndex !== -1) {
      currentDomain = domainIndex;
      updateDomainVisibility();
    }
  });
  
  // Range sliders with live updates
  attachRangeSliderListeners();

  // Goal toggle buttons (yes/no)
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

// ==========================================
// DOMAIN / TAB GENERATION
// ==========================================

function slugify(text) {
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `goal-${Date.now()}`;
}

function getGoalLabel(goal, idx) {
  if (typeof goal === 'string') return goal;
  if (goal?.label) return goal.label;
  return (
    goal?.Description ||
    goal?.Specific ||
    goal?.Specifics ||
    goal?.title ||
    goal?.name ||
    `Goal ${idx + 1}`
  );
}

function rebuildDomains() {
  const tabs = document.getElementById('checkinTabs');
  const form = document.getElementById('checkinForm');
  if (!tabs || !form) return;

  // Reset domains; keep Overall Day as first domain but do not show a tab for it
  domains = ['day'];
  tabs.innerHTML = '';

  // Remove previously generated goal domain sections
  form.querySelectorAll('.goal-domain').forEach(el => el.remove());

  // If no goals, keep the existing "Goals" tab/section visible for message
  if (!activeGoals || !activeGoals.length) {
    const goalsSection = document.getElementById('domain-goals');
    // leave tabs empty; only Overall Day will show
    if (goalsSection) goalsSection.style.display = '';
    domains = ['day']; // only day
    updateDomainVisibility();
    return;
  }

  // Hide static goals section; we will create per-goal screens
  const staticGoalsTab = document.querySelector('[data-domain="goals"]');
  const staticGoalsSection = document.getElementById('domain-goals');
  if (staticGoalsTab) staticGoalsTab.style.display = 'none';
  if (staticGoalsSection) staticGoalsSection.style.display = 'none';

  activeGoals.forEach((goal, idx) => {
    const slug = slugify(goal.id || goal.ID || goal._id || goal.goalId || `goal-${idx}`);
    goal._slug = slug;
    domains.push(slug);

    // Nav tab for this goal
    const tab = document.createElement('button');
    tab.className = 'nav-tab';
    tab.setAttribute('data-domain', slug);
    tab.setAttribute('title', label);
    tab.innerHTML = `
      <span class="tab-icon"><i class="fa-solid fa-bullseye" aria-hidden="true"></i></span>
      <span class="tab-label">Goal ${idx + 1}</span>
    `;
    tabs.appendChild(tab);

    // Section for this goal
    const section = document.createElement('div');
    section.className = 'domain-section goal-domain';
    section.id = `domain-${slug}`;
    section.innerHTML = buildGoalSection(goal, slug, idx);
    form.appendChild(section);
  });

  // Ensure we start at first domain
  currentDomain = 0;
  updateDomainVisibility();
}

function buildGoalSection(goal, slug, idx) {
  const label = getGoalLabel(goal, idx);
  const measurable = goal?.Measurable || goal?.measurable || '';
  const prompt = inferPrompt(label, measurable);
  const timeBound = goal?.Time_Bound || goal?.timebound || goal?.timeframe || '';
  const progressText = goal?.Progress || goal?.progress || '';

  return `
    <div class="section-intro">
      <h2 class="section-title">${label}</h2>
      <p class="section-description">Tell us how you did on this goal today.</p>
      ${timeBound ? `<p class="checkin-hint" style="margin-top:4px;">${timeBound}</p>` : ''}
      ${measurable ? `<p class="checkin-hint" style="margin-top:2px;">${measurable}</p>` : ''}
      ${progressText ? `<p class="checkin-hint" style="margin-top:2px;">${progressText}</p>` : ''}
    </div>
    <div class="form-domain">
      <div class="form-group">
        <label class="form-label">Did you do this today?</label>
        <div class="button-group" data-goal-did="${slug}">
          <button type="button" class="option-btn active" data-value="yes">Yes</button>
          <button type="button" class="option-btn" data-value="no">No</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">How well did you do? (1-5)</label>
        <div class="scale-input">
          <input type="range" min="1" max="5" value="3" class="range-slider" data-goal-score="${slug}">
          <div class="scale-labels"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${prompt}</label>
        <input type="text" class="text-input" data-goal-progress="${slug}" placeholder="${prompt}" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes (optional)</label>
        <textarea class="text-area" data-goal-notes="${slug}" rows="2" placeholder="Any details, obstacles, or what went well"></textarea>
      </div>
    </div>
  `;
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
  if (currentDomainName !== 'day' && currentDomainName !== 'goals') {
    const matchedIndex = activeGoals.findIndex(g => g._slug === currentDomainName);
    const matched = matchedIndex !== -1 ? activeGoals[matchedIndex] : null;
    domainLabels[currentDomainName] = matched ? getGoalLabel(matched, matchedIndex) : 'Goal';
  }
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
    
    // Render answers beneath goals tab
    renderSubmittedAnswers(checkInData.goalResponses || []);

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

function renderSubmittedAnswers(goalResponses) {
  const container = document.getElementById('goalAnswerContainer');
  if (!container) return;
  if (!goalResponses || !goalResponses.length) {
    container.innerHTML = '';
    return;
  }
  const html = goalResponses.map((g) => {
    return `
      <div class="goal-card" style="border:1px solid rgba(1,104,68,0.12); background: rgba(255,255,255,0.85);">
        <div class="domain-header" style="margin-bottom:6px;">
          <h4 class="domain-title" style="margin:0;">Goal: ${g.goalId || '—'}</h4>
        </div>
        ${typeof g.did === 'boolean' ? `<p class="form-note" style="margin: 0 0 4px 0;">Did it: ${g.did ? 'Yes' : 'No'}</p>` : ''}
        ${typeof g.score === 'number' ? `<p class="form-note" style="margin: 0 0 4px 0;">Score: ${g.score}/5</p>` : ''}
        ${g.progress ? `<p class="form-note" style="margin: 0 0 4px 0;">Progress: ${g.progress}</p>` : ''}
        ${g.notes ? `<p class="form-note" style="margin: 0;">Notes: ${g.notes}</p>` : ''}
      </div>
    `;
  }).join('');
  container.innerHTML = html;
}

function collectCheckInData() {
  const data = {
    UserID: userProfile?.userId || 'unknown',
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    dayScore: parseInt(document.getElementById('dayScore')?.value || 0, 10) || null,
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
  // No local storage fallback per requirements
  throw new Error('Not signed in. Please log in to submit your check-in.');
}


// Goals rendering (simple)
async function loadGoalsIntoForm() {
  const container = document.getElementById('goalQuestionContainer');
  const answerContainer = document.getElementById('goalAnswerContainer');
  if (!window.BenjiAPI || !window.BenjiAPI.getSession) {
    if (container) container.innerHTML = '<p class="form-note">Connect to Benji to load goals.</p>';
    rebuildDomains();
    return;
  }
  const session = window.BenjiAPI.getSession();
  if (!session || !session.user_id) {
    if (container) container.innerHTML = '<p class="form-note">Sign in to update goals.</p>';
    rebuildDomains();
    return;
  }
  if (container) container.innerHTML = '<div class="loading-spinner" style="margin: 1.5rem auto;"></div>';
  try {
    const fetched = await fetchUserGoals();
    // Keep previous goals (or cached) if fetch returns empty
    if (fetched && fetched.length) {
      activeGoals = fetched;
    } else if (!activeGoals.length) {
      const cached = sessionStorage.getItem(LAST_GOALS_KEY);
      if (cached) activeGoals = JSON.parse(cached);
    }

    // If there are no goals, show friendly message in the legacy container
    if (!activeGoals.length && container) {
      container.innerHTML = '<p class="form-note" style="text-align:center;">No goals yet. Visit the <a href="goals.html">Goals page</a> to add some.</p>';
      if (answerContainer) answerContainer.innerHTML = '';
    }

    rebuildDomains();

    // clear previous answers display
    if (answerContainer) answerContainer.innerHTML = '';
  } catch (err) {
    console.error('goal load error', err);
    if (container) container.innerHTML = '<p class="form-note">Unable to load goals right now.</p>';
    if (answerContainer) answerContainer.innerHTML = '';
  }
}

function inferPrompt(label, measurable) {
  const lower = (label || '').toLowerCase();
  if (lower.includes('sleep')) return 'Hours slept today';
  if (lower.includes('step')) return 'Steps or distance';
  if (lower.includes('run') || lower.includes('cardio')) return 'Time/distance done';
  if (lower.includes('protein') || lower.includes('calorie') || lower.includes('intake')) return 'What you logged (cals/protein/etc.)';
  if (lower.includes('strength') || lower.includes('lift') || lower.includes('squat') || lower.includes('bench')) return 'Workout completed (sets/reps/weight)';
  if (measurable) return measurable;
  return 'What did you do / measure?';
}

function collectGoalResponses() {

  const sections = Array.from(document.querySelectorAll('[data-goal-progress]')).map(input => input.getAttribute('data-goal-progress'));
  const uniqueSlugs = Array.from(new Set(sections));

  return uniqueSlugs.map(goalId => {
    const didBtns = document.querySelector(`[data-goal-did="${goalId}"] .option-btn.active`);
    const did = didBtns ? didBtns.dataset.value === 'yes' : null;
    const scoreInput = document.querySelector(`[data-goal-score="${goalId}"]`);
    const progressInput = document.querySelector(`[data-goal-progress="${goalId}"]`);
    const notesInput = document.querySelector(`[data-goal-notes="${goalId}"]`);
    const score = scoreInput ? parseInt(scoreInput.value || '0', 10) : null;
    const progress = progressInput ? (progressInput.value || '').trim() : '';
    const notes = notesInput ? (notesInput.value || '').trim() : '';
    return { goalId, did, score, progress, notes };
  }).filter(g => g.goalId);
}

// Fetch goals from backend
async function fetchUserGoals() {
  const session = window.BenjiAPI?.getSession?.();
  if (!session || !session.user_id) return [];
  try {
    const data = await window.BenjiAPI.getGoals(session.user_id);
    // Normalize several possible response shapes
    // 1) { goals: [...] }
    // 2) { accepted: [...] }
    // 3) { goals: { accepted: [...] } }
    // 4) raw array
    let goalsArray = [];
    if (Array.isArray(data)) {
      goalsArray = data;
    } else if (Array.isArray(data?.goals)) {
      goalsArray = data.goals;
    } else if (Array.isArray(data?.accepted)) {
      goalsArray = data.accepted;
    } else if (data?.goals && Array.isArray(data.goals.accepted)) {
      goalsArray = data.goals.accepted;
    }
    const normalized = goalsArray.map((g) => {
      if (typeof g === 'string') {
        return { id: g, label: g };
      }
      return g;
    });
    if (normalized.length) {
      sessionStorage.setItem(LAST_GOALS_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch (err) {
    console.error('Failed to fetch goals', err);
    // try cached
    const cached = sessionStorage.getItem(LAST_GOALS_KEY);
    if (cached) return JSON.parse(cached);
    return [];
  }
}
