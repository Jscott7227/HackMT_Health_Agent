/* --------------------------------------------------------
ROUTE MAP
Screen 5 (mental health detail) is spliced in or out
at runtime based on the consent answer on screen 3.
-------------------------------------------------------- */
var ROUTE = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13];

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
    confidence: null
};

/* --------------------------------------------------------
LABELS
-------------------------------------------------------- */
var ACTIVITY_LABELS = ['Very inactive','Lightly active','Moderately active','Very active'];

var AFFIRMATIONS = {
    'not-confident':  "That's okay – we'll meet you where you are.",
    'somewhat':       "A little doubt is normal. We'll build your confidence step by step.",
    'very':           "That's great! Let's channel that energy into your plan."
};

var GOAL_LABELS = {
    'lose-fat':      'Lose body fat',
    'build-muscle':  'Build muscle',
    'endurance':     'Improve endurance',
    'feel-healthier':'Feel healthier overall',
    'not-sure':      'Not sure yet'
};

var EXP_LABELS = {
    'beginner':     'Beginner',
    'intermediate': 'Intermediate',
    'advanced':     'Advanced'
};

var GENERIC_SCALE = { 1:'Very low', 2:'Low', 3:'Moderate', 4:'Good', 5:'Very high' };
var SLEEP_LABELS  = { 1:'Terrible',  2:'Poor', 3:'Okay',    4:'Good', 5:'Great' };

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
    if (n === 12) buildReview();

    var screens = document.querySelectorAll('.ob-screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');

    var target = document.getElementById('screen-' + n);
    if (target) {
        // Force animation restart by reflowing before adding class
        void target.offsetWidth;
        target.classList.add('active');
    }

    // progress bar
    var idx = ROUTE.indexOf(n);
    var pct = idx <= 0 ? 0 : Math.round(idx / (ROUTE.length - 1) * 100);
    if (pct > 100) pct = 100;
    document.getElementById('progressFill').style.width = pct + '%';

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
        setTimeout(function() {
            completeSetup();
        }, 3000);
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Used by screen 3 CTA – updates the route first, then advances
function advanceFrom(fromScreen) {
    if (fromScreen === 3) applyConsentRoute();
    var idx = ROUTE.indexOf(fromScreen);
    if (idx < ROUTE.length - 1) goTo(ROUTE[idx + 1]);
}

function goToReview() { goTo(12); }

/* --------------------------------------------------------
CONSENT GATING
-------------------------------------------------------- */
function applyConsentRoute() {
    var base = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13];
    if (state.mentalConsent === 'yes') {
        // insert screen 5 right after screen 4
        for (var i = 0; i < base.length; i++) {
            if (base[i] === 4) { base.splice(i + 1, 0, 5); break; }
        }
    }
    ROUTE = base;
    updateStepLabels();
}

/* --------------------------------------------------------
SINGLE-SELECT OPTION CARDS
-------------------------------------------------------- */
function selectOption(el) {
    var group = el.dataset.group;
    var cards = document.querySelectorAll('.ob-option-card[data-group="' + group + '"]');
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove('selected');
    el.classList.add('selected');
    state[group] = el.dataset.value;
    enableCurrentCTA();
}

function enableCurrentCTA() {
    var active = document.querySelector('.ob-screen.active');
    if (!active) return;
    var cta = active.querySelector('.ob-cta[disabled]');
    if (!cta) return;
    if (active.querySelector('.ob-option-card.selected')) cta.removeAttribute('disabled');
}

/* --------------------------------------------------------
MULTI-SELECT CARDS
-------------------------------------------------------- */
function toggleMulti(el) {
    el.classList.toggle('selected');
}

function toggleMultiNone(el, listId) {
    var list = document.getElementById(listId);
    var wasOn = el.classList.contains('selected');
    var cards = list.querySelectorAll('.ob-multi-card');
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove('selected');
    if (!wasOn) el.classList.add('selected');
}

/* --------------------------------------------------------
1–5 LABELED SCALE  (mood, stress, energy, sleep)
-------------------------------------------------------- */
function selectScale(field, value, el) {
    var containerId = field + 'Scale';
    var container = document.getElementById(containerId);
    if (container) {
        var pips = container.querySelectorAll('.ob-scale-pip');
        for (var i = 0; i < pips.length; i++) pips[i].classList.remove('selected');
    }
    el.classList.add('selected');
    state[field] = value;

    // Screen 5 CTA gates on both mood AND stress
    if (field === 'mood' || field === 'stress') {
        var cta5 = document.getElementById('cta-5');
        if (cta5 && state.mood && state.stress) cta5.removeAttribute('disabled');
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
        document.getElementById('heightMetric').style.display  = (unit === 'metric')   ? 'flex' : 'none';
        document.getElementById('heightImperial').style.display = (unit === 'imperial') ? 'flex' : 'none';
    } else {
        state.weightUnit = unit;
        document.getElementById('weightMetric').style.display  = (unit === 'metric')   ? 'flex' : 'none';
        document.getElementById('weightImperial').style.display = (unit === 'imperial') ? 'flex' : 'none';
    }
    validateMetric();
}

function validateMetric() {
    var hCta = document.getElementById('cta-6');
    if (state.heightUnit === 'imperial') {
        var ft   = document.getElementById('heightFt').value;
        var inch = document.getElementById('heightIn').value;
        state.height = (ft || inch) ? ((ft||'0') + ' ft ' + (inch||'0') + ' in') : null;
    } else {
        var cm = document.getElementById('heightCm').value;
        state.height = cm ? (cm + ' cm') : null;
    }
    if (hCta) {
        if (state.height) hCta.removeAttribute('disabled');
        else hCta.setAttribute('disabled','');
    }

    if (state.weightUnit === 'imperial') {
        var lb = document.getElementById('weightLb').value;
        state.weight = lb ? (lb + ' lb') : null;
    } else {
        var kg = document.getElementById('weightKg').value;
        state.weight = kg ? (kg + ' kg') : null;
    }
}

function skipWeight() {
    state.weightSkipped = true;
    state.weight = null;
    goTo(8);
}

/* --------------------------------------------------------
ACTIVITY SLIDER
-------------------------------------------------------- */
function updateActivity() {
    state.activity = parseInt(document.getElementById('activitySlider').value);
    document.getElementById('activityLabel').textContent = ACTIVITY_LABELS[state.activity];
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
    document.getElementById('cta-11').removeAttribute('disabled');
}

/* --------------------------------------------------------
REVIEW – assembles summary from state
-------------------------------------------------------- */
function buildReview() {
    var grid = document.getElementById('reviewGrid');
    grid.innerHTML = '';
    var items = [];

    if (state.goal)
        items.push({ icon:'<i class="fa-solid fa-bullseye"></i>', key:'Goal', value: GOAL_LABELS[state.goal] || state.goal });
    if (state.experience)
        items.push({ icon:'<i class="fa-solid fa-chart-simple"></i>', key:'Experience', value: EXP_LABELS[state.experience] });

    if (state.mentalConsent === 'yes') {
        if (state.mood)   items.push({ icon:'<i class="fa-solid fa-face-smile"></i>', key:'Mood',   value: GENERIC_SCALE[state.mood] });
        if (state.stress) items.push({ icon:'<i class="fa-solid fa-spa"></i>', key:'Stress', value: GENERIC_SCALE[state.stress] });
    }

    if (state.height)
        items.push({ icon:'<i class="fa-solid fa-ruler-vertical"></i>', key:'Height', value: state.height });
    if (state.weightSkipped)
        items.push({ icon:'<i class="fa-solid fa-weight-scale"></i>', key:'Weight', value: 'Not provided' });
    else if (state.weight)
        items.push({ icon:'<i class="fa-solid fa-weight-scale"></i>', key:'Weight', value: state.weight });

    items.push({ icon:'<i class="fa-solid fa-person-running"></i>', key:'Activity', value: ACTIVITY_LABELS[state.activity] });
    if (state.energy) items.push({ icon:'<i class="fa-solid fa-bolt"></i>', key:'Energy', value: GENERIC_SCALE[state.energy] });
    if (state.sleep)  items.push({ icon:'<i class="fa-solid fa-moon"></i>', key:'Sleep',  value: SLEEP_LABELS[state.sleep] });

    var cCards = document.querySelectorAll('#constraintList .ob-multi-card.selected');
    if (cCards.length) {
        var cL = [];
        for (var i = 0; i < cCards.length; i++) cL.push(cCards[i].querySelector('span:last-child').textContent.trim());
        items.push({ icon:'<i class="fa-solid fa-clock"></i>', key:'Lifestyle', value: cL.join(', ') });
    }

    var hCards = document.querySelectorAll('#healthList .ob-multi-card.selected');
    if (hCards.length) {
        var hL = [];
        for (var i = 0; i < hCards.length; i++) hL.push(hCards[i].querySelector('span:last-child').textContent.trim());
        items.push({ icon:'<i class="fa-solid fa-heart-pulse"></i>', key:'Health', value: hL.join(', ') });
    }

    var confMap = { 'not-confident':'Not confident', 'somewhat':'Somewhat confident', 'very':'Very confident' };
    if (state.confidence)
        items.push({ icon:'<i class="fa-solid fa-comment"></i>', key:'Confidence', value: confMap[state.confidence] });

    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        grid.innerHTML +=
            '<div class="ob-review-item">' +
                '<div class="ob-review-left">' +
                    '<span class="ob-review-icon">' + it.icon + '</span>' +
                    '<span class="ob-review-key">'  + it.key  + '</span>' +
                '</div>' +
                '<span class="ob-review-value">' + it.value + '</span>' +
            '</div>';
    }
}

/* --------------------------------------------------------
INIT
-------------------------------------------------------- */
document.getElementById('heightMetric').style.display  = 'none';
document.getElementById('heightImperial').style.display = 'flex';
document.getElementById('weightMetric').style.display  = 'none';
document.getElementById('weightImperial').style.display = 'flex';
updateStepLabels();

/* --------------------------------------------------------
COMPLETE SETUP - Redirect to main app
-------------------------------------------------------- */
function completeSetup() {
    // Save onboarding data to localStorage
    localStorage.setItem('onboardingComplete', 'true');
    localStorage.setItem('userProfile', JSON.stringify(state));
    
    // Add a small delay for user feedback (optional)
    var btn = document.querySelector('#screen-12 .ob-cta');
    btn.textContent = 'Redirecting...';
    btn.disabled = true;
    
    // Redirect to main chat page after brief delay
    setTimeout(function() {
        window.location.href = 'index.html';
    }, 800);
}
