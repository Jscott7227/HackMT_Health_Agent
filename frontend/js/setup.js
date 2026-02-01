/* --------------------------------------------------------
ROUTE MAP
Screen 5 (mental health detail) is spliced in or out
at runtime based on the consent answer on screen 3.
-------------------------------------------------------- */
var ROUTE = [1, 2, 3, 4, 16, 6, 7, 8, 9, 10, 14, 15, 11, 12, 13];
var returnToReview = false;
var currentRouteIndex = 0;
const session = JSON.parse(
    sessionStorage.getItem("sanctuary_session") ||
    localStorage.getItem("sanctuary_session") ||
    "{}"
);

/* --------------------------------------------------------
STATE – mirrors the profile schema from the handoff doc
-------------------------------------------------------- */
var state = {
    goal: null,
    experience: null,
    mentalConsent: null,
    mood: null,
    stress: null,
    mentalReflection: null,
    mentalConsentNote: null,
    height: null,
    heightUnit: 'imperial',
    weight: null,
    weightSkipped: false,
    weightUnit: 'imperial',
    activity: 1,
    energy: null,
    sleep: null,
    constraints: [],
    health: [],
    confidence: null,
    gender: null,
    cycleTracking: null,
    medTracking: null,
    medList: null,
    healthDetail: null,
    weightTouched: false,
    activityTouched: false,
    constraintsTouched: false,
    healthTouched: false
};

/* --------------------------------------------------------
LABELS
-------------------------------------------------------- */
var ACTIVITY_LABELS = ['Very inactive', 'Lightly active', 'Moderately active', 'Very active'];

var AFFIRMATIONS = {
    'not-confident': "That's okay – we'll meet you where you are.",
    'somewhat': "A little doubt is normal. We'll build your confidence step by step.",
    'very': "That's great! Let's channel that energy into your plan."
};

var GOAL_LABELS = {
    'lose-fat': 'Lose body fat',
    'build-muscle': 'Build muscle',
    'endurance': 'Improve endurance',
    'feel-healthier': 'Feel healthier overall',
    'not-sure': 'Not sure yet'
};

var EXP_LABELS = {
    'beginner': 'Beginner',
    'intermediate': 'Intermediate',
    'advanced': 'Advanced'
};

var GENERIC_SCALE = { 1: 'Very low', 2: 'Low', 3: 'Moderate', 4: 'Good', 5: 'Very high' };
var SLEEP_LABELS = { 1: 'Terrible', 2: 'Poor', 3: 'Okay', 4: 'Good', 5: 'Great' };

/* --------------------------------------------------------
BACKEND HELPERS
-------------------------------------------------------- */
var API_BASE = "http://127.0.0.1:8000";

function getSession() {
    var s1 = localStorage.getItem("sanctuary_session");
    if (s1) return JSON.parse(s1);
    var s2 = sessionStorage.getItem("sanctuary_session");
    if (s2) return JSON.parse(s2);
    return null;
}

function buildBenjiFacts() {
    var factsObj = {};
if (state.goal) factsObj.goal = GOAL_LABELS[state.goal] || state.goal;
if (state.experience) factsObj.experience = EXP_LABELS[state.experience] || state.experience;
if (state.constraints && state.constraints.length) factsObj.constraints = state.constraints;
if (state.health && state.health.length) {
    factsObj.health = state.health;
    if (state.healthDetail) factsObj.healthDetail = state.healthDetail;
}
if (state.gender) factsObj.gender = state.gender;
if (state.cycleTracking) factsObj.cycleTracking = state.cycleTracking;
if (state.medTracking === 'yes') factsObj.medications = state.medList || 'Yes';
if (state.mentalReflection) factsObj.notes = state.mentalReflection;
if (state.mentalConsentNote) factsObj.mentalConsentNote = state.mentalConsentNote;
if (state.mood) factsObj.mood = GENERIC_SCALE[state.mood];
if (state.stress) factsObj.stress = GENERIC_SCALE[state.stress];
if (state.energy) factsObj.energy = GENERIC_SCALE[state.energy];
if (state.sleep) factsObj.sleep = SLEEP_LABELS[state.sleep];
if (state.confidence) factsObj.confidence = state.confidence;
return factsObj;
}

/* --------------------------------------------------------
ROUTE HELPERS – dynamic step counting
-------------------------------------------------------- */
function totalSteps() {
    var count = 0;
    for (var i = 0; i < ROUTE.length; i++) {
        var s = ROUTE[i];
        if (s !== 1 && s !== 12 && s !== 13) count++;
    }
    return count;
}

function currentStep(screenId) {
    var step = 0;
    for (var i = 0; i < ROUTE.length; i++) {
        var s = ROUTE[i];
        if (s !== 1 && s !== 12 && s !== 13) step++;
        if (s === screenId) return step;
    }
    return 0;
}

function updateStepLabels() {
    var total = totalSteps();
    for (var i = 0; i < ROUTE.length; i++) {
        var id = ROUTE[i];
        var el = document.getElementById('stepLabel-' + id);
        if (!el) continue;
        var step = currentStep(id);
        if (step > 0) el.textContent = 'Step ' + step + ' of ' + total;
    }
}

/* --------------------------------------------------------
NAVIGATION
-------------------------------------------------------- */
function goTo(n) {
    updateStepLabels();
    if (n === 12) buildReview();

    var screens = document.querySelectorAll('.ob-screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');

    var target = document.getElementById('screen-' + n);
    if (target) {
        var card = document.querySelector('.onboarding-card');
        if (card) {
            card.classList.remove('animate');
            void card.offsetWidth;
            card.classList.add('animate');
        }
        target.classList.add('active');
    }

    // progress bar
    var idx = ROUTE.indexOf(n);
    var pct = idx <= 0 ? 0 : Math.round(idx / (ROUTE.length - 1) * 100);
    if (pct > 100) pct = 100;
    document.getElementById('progressFill').style.width = pct + '%';
    if (idx >= 0) currentRouteIndex = idx;

    // re-trigger ring on analysis screen
    /*
    if (n === 13) {
        var ring = target.querySelector('.ob-ring-fill');
        if (ring) {
            ring.style.animation = 'none';
            void ring.offsetWidth;
            ring.style.animation = '';
        }
    }
    */
    if (n === 13) {
        var ring = target.querySelector('.ob-ring-fill');
        if (ring) {
            ring.style.animation = 'none';
            void ring.offsetWidth;
            ring.style.animation = '';
        }
        // Auto-complete after 3 seconds of "analyzing"
        fetchGoalsAndContinue();
    }

    updateCtaForScreen(n);
    updateBackVisibility(n);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function fetchGoalsAndContinue() {
    var finalGoal = localStorage.getItem('finalGoal') || "";
    const userId = session.user_id || null;

    try {
        var res = await fetch('http://localhost:8000/goals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                user_goal: finalGoal
            })
        });

        if (!res.ok) throw new Error('Failed to fetch goals');

        var data = await res.json();
        var smartGoals = data.smart_goals || [];

        localStorage.setItem('smartGoals', JSON.stringify(smartGoals));

        // slight delay so animation feels intentional
        setTimeout(function () {
            completeSetup();
        }, 800);

    } catch (err) {
        console.error("Goal fetch error:", err);
        completeSetup(); // fail forward instead of trapping user
    }
}


// Used by screen 3 CTA – updates the route first, then advances
function advanceFrom(fromScreen) {
    if (fromScreen === 3) applyConsentRoute();
    if (fromScreen === 16) applyGenderRoute();
    var idx = ROUTE.indexOf(fromScreen);
    if (idx < ROUTE.length - 1) goTo(ROUTE[idx + 1]);
}

function goToReview() { goTo(12); }

function handleContinue(nextId) {
    if (returnToReview) {
        returnToReview = false;
        goTo(12);
    } else {
        goTo(nextId);
    }
}

function handleAdvanceFrom(screenId) {
    if (returnToReview) {
        returnToReview = false;
        goTo(12);
    } else {
        advanceFrom(screenId);
    }
}

function goToEdit(screenId) {
    returnToReview = true;
    goTo(screenId);
}

function goBack() {
    if (currentRouteIndex > 0) {
        goTo(ROUTE[currentRouteIndex - 1]);
    }
}

function updateBackVisibility(screenId) {
    var btn = document.getElementById('obBackBtn');
    if (!btn) return;
    btn.style.display = (screenId && screenId > 1) ? 'inline-flex' : 'none';
}

/* --------------------------------------------------------
CTA LABELS – allow skipping any question
-------------------------------------------------------- */
function setCtaLabel(cta, hasData) {
    if (!cta) return;
    cta.textContent = hasData ? 'Continue' : 'Skip for now';
    cta.classList.toggle('is-skip', !hasData);
    cta.removeAttribute('disabled');
}

function updateCtaForScreen(screenId) {
    var id = screenId || (function () {
        var active = document.querySelector('.ob-screen.active');
        if (!active) return null;
        var m = active.id && active.id.match(/screen-(\d+)/);
        return m ? parseInt(m[1], 10) : null;
    })();
    if (!id) return;

    if (id === 2) return setCtaLabel(document.getElementById('cta-2'), !!state.goal);
    if (id === 3) {
        var cta3 = document.getElementById('cta-3');
        if (!cta3) return;
        cta3.textContent = 'Continue';
        cta3.classList.remove('is-skip');
        if (state.mentalConsent) cta3.removeAttribute('disabled');
        else cta3.setAttribute('disabled', '');
        return;
    }
    if (id === 4) return setCtaLabel(document.getElementById('cta-4'), !!state.experience);
    if (id === 5) return setCtaLabel(document.getElementById('cta-5'), !!(state.mood || state.stress || state.mentalReflection));
    if (id === 6) return setCtaLabel(document.getElementById('cta-6'), !!state.height);
    if (id === 7) return setCtaLabel(document.getElementById('cta-7'), !!(state.weight || state.weightSkipped));
    if (id === 8) return setCtaLabel(document.querySelector('#screen-8 .ob-cta'), !!(state.activityTouched || state.energy || state.sleep));
    if (id === 9) return setCtaLabel(document.querySelector('#screen-9 .ob-cta'), !!state.constraintsTouched);
    if (id === 10) return setCtaLabel(document.querySelector('#screen-10 .ob-cta'), !!state.healthTouched);
    if (id === 11) return setCtaLabel(document.getElementById('cta-11'), !!state.confidence);
    if (id === 12) return setCtaLabel(
        document.querySelector('#screen-12 .ob-cta'),
        !!state.finalGoal
    );
    if (id === 14) return setCtaLabel(document.getElementById('cta-14'), !!state.cycleTracking);
    if (id === 15) {
        var medHasData = state.medTracking === 'no' || (state.medTracking === 'yes' && !!state.medList);
        return setCtaLabel(document.getElementById('cta-15'), medHasData);
    }
    if (id === 16) return setCtaLabel(document.getElementById('cta-16'), !!state.gender);
}

/* --------------------------------------------------------
CONSENT GATING
-------------------------------------------------------- */
function applyConsentRoute() {
    var base = [1, 2, 3, 4, 16, 6, 7, 8, 9, 10, 14, 15, 11, 12, 13];
    if (state.mentalConsent === 'yes') {
        // insert screen 5 right after screen 4
        for (var i = 0; i < base.length; i++) {
            if (base[i] === 4) { base.splice(i + 1, 0, 5); break; }
        }
    }
    ROUTE = base;
    updateStepLabels();
}

// Update route for cycle screen: remove for male, ensure present for non-male
function applyGenderRoute() {
    if (state.gender === 'male') {
        state.cycleTracking = 'not-applicable';
        var idx = ROUTE.indexOf(14);
        if (idx !== -1) ROUTE.splice(idx, 1);
    } else {
        // Ensure cycle screen is in route (e.g. user changed from male to female)
        if (ROUTE.indexOf(14) === -1) {
            var insertAt = ROUTE.indexOf(10) + 1;
            if (insertAt > 0) ROUTE.splice(insertAt, 0, 14);
        }
    }
    updateStepLabels();
}

/* --------------------------------------------------------
SINGLE-SELECT OPTION CARDS
-------------------------------------------------------- */
function selectOption(el) {
    var group = el.dataset.group;
    var wasSelected = el.classList.contains('selected');
    var cards = document.querySelectorAll('.ob-option-card[data-group="' + group + '"]');
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove('selected');
    if (wasSelected) {
        state[group] = null;
    } else {
        el.classList.add('selected');
        state[group] = el.dataset.value;
    }
    if (group === 'gender') applyGenderRoute();
    updateCtaForScreen();
}

function enableCurrentCTA() {
    updateCtaForScreen();
}

/* --------------------------------------------------------
MULTI-SELECT CARDS
-------------------------------------------------------- */
function toggleMulti(el) {
    var list = el.closest('.ob-multiselect-list');
    if (list) {
        var noneCards = list.querySelectorAll('[data-value*="none"], [data-value*="prefer-not"]');
        for (var i = 0; i < noneCards.length; i++) noneCards[i].classList.remove('selected');
    }
    el.classList.toggle('selected');
    syncMultiState();
}

function toggleMultiNone(el, listId) {
    var list = document.getElementById(listId);
    var wasOn = el.classList.contains('selected');
    var cards = list.querySelectorAll('.ob-multi-card');
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove('selected');
    if (!wasOn) el.classList.add('selected');
    syncMultiState();
}

/* --------------------------------------------------------
1–5 LABELED SCALE  (mood, stress, energy, sleep)
-------------------------------------------------------- */
function toggleScale(field, value, el) {
    var containerId = field + 'Scale';
    var container = document.getElementById(containerId);
    var descLine = document.getElementById(field + 'Desc');
    if (el.classList.contains('selected')) {
        el.classList.remove('selected');
        state[field] = null;
        if (descLine) { descLine.textContent = '\u00a0'; descLine.classList.remove('active'); }
    } else {
        if (container) {
            var pips = container.querySelectorAll('.ob-scale-pip');
            for (var i = 0; i < pips.length; i++) pips[i].classList.remove('selected');
        }
        el.classList.add('selected');
        state[field] = value;
        if (descLine) { descLine.textContent = el.dataset.desc || ''; descLine.classList.add('active'); }
    }
    updateCtaForScreen();
}

function toggleMentalDesc() {
    var desc = document.getElementById('mentalConsentDesc');
    if (desc) {
        desc.style.display = (state.mentalConsent === 'yes') ? 'block' : 'none';
    }
}

/* --------------------------------------------------------
COLLAPSIBLE
-------------------------------------------------------- */
function toggleCollapsible(trigger) {
    trigger.parentElement.classList.toggle('open');
}

/* --------------------------------------------------------
HEIGHT / WEIGHT
-------------------------------------------------------- */
function switchUnit(field, unit, btn) {
    var toggleEl = (field === 'height')
        ? document.getElementById('heightUnitToggle')
        : document.getElementById('weightUnitToggle');
    var btns = toggleEl.querySelectorAll('.ob-unit-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    btn.classList.add('active');

    if (field === 'height') {
        state.heightUnit = unit;
        document.getElementById('heightMetric').style.display = (unit === 'metric') ? 'flex' : 'none';
        document.getElementById('heightImperial').style.display = (unit === 'imperial') ? 'flex' : 'none';
    } else {
        state.weightUnit = unit;
        document.getElementById('weightMetric').style.display = (unit === 'metric') ? 'flex' : 'none';
        document.getElementById('weightImperial').style.display = (unit === 'imperial') ? 'flex' : 'none';
    }
    validateMetric();
}

function validateMetric() {
    var hCta = document.getElementById('cta-6');
    if (state.heightUnit === 'imperial') {
        var ft = document.getElementById('heightFt').value;
        var inchInput = document.getElementById('heightIn');
        var inch = inchInput.value;

        // Validate inches are 0-11
        if (inch !== '' && (parseInt(inch) < 0 || parseInt(inch) > 11)) {
            inchInput.value = Math.min(11, Math.max(0, parseInt(inch) || 0));
            inch = inchInput.value;
        }

        state.height = (ft || inch) ? ((ft || '0') + ' ft ' + (inch || '0') + ' in') : null;
    } else {
        var cm = document.getElementById('heightCm').value;
        state.height = cm ? (cm + ' cm') : null;
    }
    if (hCta) setCtaLabel(hCta, !!state.height);

    if (state.weightUnit === 'imperial') {
        var lb = document.getElementById('weightLb').value;
        state.weight = lb ? (lb + ' lb') : null;
    } else {
        var kg = document.getElementById('weightKg').value;
        state.weight = kg ? (kg + ' kg') : null;
    }
    state.weightTouched = !!state.weight;
    setCtaLabel(document.getElementById('cta-7'), !!(state.weight || state.weightSkipped));
}

function skipWeight() {
    state.weightSkipped = true;
    state.weight = null;
    setCtaLabel(document.getElementById('cta-7'), true);
    goTo(8);
}

/* --------------------------------------------------------
ACTIVITY SLIDER
-------------------------------------------------------- */
function updateActivity() {
    state.activity = parseInt(document.getElementById('activitySlider').value);
    document.getElementById('activityLabel').textContent = ACTIVITY_LABELS[state.activity];
    state.activityTouched = true;
    updateCtaForScreen(8);
}

/* --------------------------------------------------------
CONFIDENCE (3-button)
-------------------------------------------------------- */
function selectConfidence(el) {
    var btns = document.querySelectorAll('.ob-scale-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('selected');
    el.classList.add('selected');
    state.confidence = el.dataset.value;

    var aff = document.getElementById('affirmation');
    aff.style.display = 'block';
    aff.innerHTML = '<p>' + AFFIRMATIONS[state.confidence] + '</p>';
    updateCtaForScreen(11);
}

/* --------------------------------------------------------
REVIEW – assembles summary from state
-------------------------------------------------------- */
function buildReview() {
    var grid = document.getElementById('reviewGrid');
    grid.innerHTML = '';
    var items = [];
    var confMap = { 'not-confident': 'Not confident', 'somewhat': 'Somewhat confident', 'very': 'Very confident' };
    var genderMap = { 'male': 'Male', 'female': 'Female', 'other': 'Other', 'prefer-not-to-say': 'Prefer not to say' };
    var cycleMap = { 'yes': 'Yes', 'no': 'No', 'not-applicable': 'N/A' };
    var consentLabel = state.mentalConsent === 'yes' ? 'Yes' : state.mentalConsent === 'no' ? 'No' : 'N/A';

    function addItem(icon, key, value, editId) {
        items.push({ icon: icon, key: key, value: value || '--', editId: editId });
    }

    addItem('<i class="fa-solid fa-bullseye"></i>', 'Goal', state.goal ? (GOAL_LABELS[state.goal] || state.goal) : '--', 2);
    addItem('<i class="fa-solid fa-brain"></i>', 'Mental health', consentLabel, 3);
    addItem('<i class="fa-solid fa-chart-simple"></i>', 'Experience', state.experience ? EXP_LABELS[state.experience] : '--', 4);

    if (state.mentalConsent === 'yes') {
        addItem('<i class="fa-solid fa-face-smile"></i>', 'Mood', state.mood ? GENERIC_SCALE[state.mood] : '--', 5);
        addItem('<i class="fa-solid fa-spa"></i>', 'Stress', state.stress ? GENERIC_SCALE[state.stress] : '--', 5);
    }

    addItem('<i class="fa-solid fa-venus-mars"></i>', 'Gender', state.gender ? (genderMap[state.gender] || state.gender) : '--', 16);
    addItem('<i class="fa-solid fa-ruler-vertical"></i>', 'Height', state.height || '--', 6);
    if (state.weightSkipped) {
        addItem('<i class="fa-solid fa-weight-scale"></i>', 'Weight', 'Not provided', 7);
    } else {
        addItem('<i class="fa-solid fa-weight-scale"></i>', 'Weight', state.weight || '--', 7);
    }

    addItem('<i class="fa-solid fa-person-running"></i>', 'Activity', state.activityTouched ? ACTIVITY_LABELS[state.activity] : '--', 8);
    addItem('<i class="fa-solid fa-bolt"></i>', 'Energy', state.energy ? GENERIC_SCALE[state.energy] : '--', 8);
    addItem('<i class="fa-solid fa-moon"></i>', 'Sleep', state.sleep ? SLEEP_LABELS[state.sleep] : '--', 8);

    addItem('<i class="fa-solid fa-sun"></i>', 'Lifestyle', state.constraints && state.constraints.length ? state.constraints.join(', ') : '--', 9);
    var healthVal = state.health && state.health.length ? state.health.join(', ') : '--';
    if (state.healthDetail) healthVal += ' — ' + state.healthDetail;
    addItem('<i class="fa-solid fa-heart-pulse"></i>', 'Health', healthVal, 10);
    if (state.gender !== 'male') {
        addItem('<i class="fa-solid fa-calendar-days"></i>', 'Cycle tracking', state.cycleTracking ? (cycleMap[state.cycleTracking] || state.cycleTracking) : '--', 14);
    }
    addItem('<i class="fa-solid fa-pills"></i>', 'Medications', state.medTracking === 'yes' ? (state.medList || 'Yes') : state.medTracking === 'no' ? 'None' : '--', 15);
    addItem('<i class="fa-solid fa-comment"></i>', 'Confidence', state.confidence ? confMap[state.confidence] : '--', 11);

    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        grid.innerHTML +=
            '<div class="ob-review-item">' +
            '<div class="ob-review-left">' +
            '<span class="ob-review-icon">' + it.icon + '</span>' +
            '<span class="ob-review-key">' + it.key + '</span>' +
            '</div>' +
            '<span class="ob-review-value">' + it.value + '</span>' +
            (it.editId ? ('<button class="ob-review-edit" type="button" onclick="goToEdit(' + it.editId + ')" aria-label="Edit"><i class="fa-solid fa-pencil"></i></button>') : '') +
            '</div>';
    }
}

function syncMultiState() {
    var cCards = document.querySelectorAll('#constraintList .ob-multi-card.selected');
    var hCards = document.querySelectorAll('#healthList .ob-multi-card.selected');
    state.constraints = [];
    state.health = [];
    for (var i = 0; i < cCards.length; i++) {
        state.constraints.push(cCards[i].querySelector('span:last-child').textContent.trim());
    }
    for (var j = 0; j < hCards.length; j++) {
        state.health.push(hCards[j].querySelector('span:last-child').textContent.trim());
    }
    state.constraintsTouched = state.constraints.length > 0;
    state.healthTouched = state.health.length > 0;
    updateCtaForScreen(9);
    updateCtaForScreen(10);
}

/* --------------------------------------------------------
HEALTH DETAIL & MEDICATION INPUT TOGGLES
-------------------------------------------------------- */
function toggleHealthDetail() {
    var list = document.getElementById('healthList');
    var wrap = document.getElementById('healthDetailWrap');
    if (!list || !wrap) return;
    var detailValues = ['joint-pain', 'cardio-concerns', 'metabolic'];
    var show = false;
    for (var i = 0; i < detailValues.length; i++) {
        var card = list.querySelector('[data-value="' + detailValues[i] + '"]');
        if (card && card.classList.contains('selected')) { show = true; break; }
    }
    wrap.style.display = show ? 'block' : 'none';
    if (!show) {
        var input = document.getElementById('healthDetailInput');
        if (input) { input.value = ''; state.healthDetail = null; }
    }
}

function toggleMedInput(show) {
    var wrap = document.getElementById('medInputWrap');
    if (wrap) wrap.style.display = show ? 'block' : 'none';
    if (!show) {
        var input = document.getElementById('medListInput');
        if (input) { input.value = ''; state.medList = null; }
    }
    updateCtaForScreen(15);
}

/* --------------------------------------------------------
INIT
-------------------------------------------------------- */
document.getElementById('heightMetric').style.display = 'none';
document.getElementById('heightImperial').style.display = 'flex';
document.getElementById('weightMetric').style.display = 'none';
document.getElementById('weightImperial').style.display = 'flex';
updateStepLabels();
updateCtaForScreen(2);
updateBackVisibility(1);

var initialCard = document.querySelector('.onboarding-card');
if (initialCard) initialCard.classList.add('animate');

var reflectionInput = document.getElementById('mentalReflection');
if (reflectionInput) {
    reflectionInput.addEventListener('input', function () {
        state.mentalReflection = reflectionInput.value.trim() || null;
        updateCtaForScreen(5);
    });
}

var mentalConsentNote = document.getElementById('mentalConsentNote');
if (mentalConsentNote) {
    mentalConsentNote.addEventListener('input', function () {
        state.mentalConsentNote = mentalConsentNote.value.trim() || null;
    });
}

var healthDetailInput = document.getElementById('healthDetailInput');
if (healthDetailInput) {
    healthDetailInput.addEventListener('input', function () {
        state.healthDetail = healthDetailInput.value.trim() || null;
    });
}

var medInput = document.getElementById('medListInput');
if (medInput) {
    medInput.addEventListener('input', function () {
        state.medList = medInput.value.trim() || null;
        updateCtaForScreen(15);
    });
}

var finalGoalInput = document.getElementById('finalGoalInput');
if (finalGoalInput) {
    finalGoalInput.addEventListener('input', function () {
        state.finalGoal = finalGoalInput.value.trim();
        updateCtaForScreen(12);
    });
}

var finalGoalInput = document.getElementById('finalGoalInput');

if (finalGoalInput) {
    finalGoalInput.addEventListener('input', function () {
        localStorage.setItem('finalGoal', finalGoalInput.value);
    });
}

function digitsOnly(el) {
  el.value = (el.value || "").replace(/[^\d]/g, "");
}

/* --------------------------------------------------------
COMPLETE SETUP - Redirect to main app
-------------------------------------------------------- */
async function completeSetup() {
    // Save onboarding data to localStorage
    localStorage.setItem('onboardingComplete', 'true');
    localStorage.setItem('userProfile', JSON.stringify(state));

    // Add a small delay for user feedback (optional)
    var btn = document.querySelector('#screen-12 .ob-cta');
    btn.textContent = 'Redirecting...';
    btn.disabled = true;

    // Persist profile info to backend if available
    // Backend expects: { benji_facts?, height?, weight? } (flat, lowercase snake_case)
    try {
        var session = getSession();
        if (session && session.user_id) {
            // Build BenjiFacts as a JSON object, then stringify it
            var factsObj = {};
            if (state.goal) factsObj.goal = GOAL_LABELS[state.goal] || state.goal;
            if (state.experience) factsObj.experience = EXP_LABELS[state.experience] || state.experience;
            if (state.constraints && state.constraints.length) factsObj.constraints = state.constraints;
            if (state.health && state.health.length) {
                factsObj.health = state.health;
                if (state.healthDetail) factsObj.healthDetail = state.healthDetail;
            }
            if (state.gender) factsObj.gender = state.gender;
            if (state.cycleTracking) factsObj.cycleTracking = state.cycleTracking;
            if (state.medTracking === 'yes') factsObj.medications = state.medList || 'Yes';
            if (state.mentalReflection) factsObj.notes = state.mentalReflection;
            if (state.mentalConsentNote) factsObj.mentalConsentNote = state.mentalConsentNote;
            if (state.mood) factsObj.mood = GENERIC_SCALE[state.mood];
            if (state.stress) factsObj.stress = GENERIC_SCALE[state.stress];
            if (state.energy) factsObj.energy = GENERIC_SCALE[state.energy];
            if (state.sleep) factsObj.sleep = SLEEP_LABELS[state.sleep];
            if (state.confidence) factsObj.confidence = state.confidence;

            var payload = {
                benji_facts: JSON.stringify(factsObj),
                height: state.height || null,
                weight: state.weight || null
            };

            // Try POST first (during onboarding, profile shouldn't exist yet)
            var res = await fetch(API_BASE + "/profileinfo/" + session.user_id, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            // If profile already exists (409), update it with PATCH
            if (res.status === 409) {
                await fetch(API_BASE + "/profileinfo/" + session.user_id, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
            }
            
            if (!res.ok && res.status !== 409) {
                console.error("ProfileInfo creation failed:", res.status, await res.text());
            }
        }
    } catch (err) {
        console.error("Profile sync failed:", err);
    }

    // Smooth fade-out then transition to goals
    document.body.classList.add('page-transition-out');
    setTimeout(function () {
        window.location.href = 'goals.html';
    }, 450);
}