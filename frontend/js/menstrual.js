(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ── Constants ──────────────────────────────────────── */
  const FLOWLOG_KEY  = "Benji_flowLog";
  const CYCLE_LENGTH = 28;
  const BACKEND_URL = "http://127.0.0.1:8000";

  const PHASES = [
    { name: "Menstrual",   start: 1,  end: 5,  color: "#c77e5d" },
    { name: "Follicular",  start: 6,  end: 13, color: "#4fc193" },
    { name: "Ovulation",   start: 14, end: 16, color: "#b4a5c4" },
    { name: "Luteal",      start: 17, end: 28, color: "#e8a87c" },
  ];

  const FLOW_DOTS = { light: 1, medium: 2, heavy: 3, clots: 3 };

  const RECOMMENDATIONS = {
    Menstrual: [
      { icon: "fa-mug-hot",       title: "Rest & Recover",  text: "Prioritize rest. Gentle walks or yoga are ideal. Avoid intense workouts if cramps are strong." },
      { icon: "fa-bowl-food",     title: "Iron-Rich Foods",  text: "Eat leafy greens, red meat, lentils, and dark chocolate to replenish iron lost during menstruation." },
      { icon: "fa-droplet",       title: "Stay Hydrated",    text: "Drink warm water or herbal teas (ginger, chamomile) to ease bloating and cramps." },
      { icon: "fa-bed",           title: "Sleep Well",       text: "Aim for 8+ hours. Use a heating pad on your lower abdomen to ease discomfort before sleep." },
    ],
    Follicular: [
      { icon: "fa-dumbbell",      title: "Ramp Up Training", text: "Energy rises as estrogen climbs. Great time for strength training, HIIT, or trying new workouts." },
      { icon: "fa-carrot",        title: "Fuel with Protein", text: "Focus on lean proteins, fermented foods, and complex carbs to support muscle building." },
      { icon: "fa-brain",         title: "Plan & Create",    text: "Cognitive function peaks. Tackle challenging tasks, plan projects, and brainstorm ideas." },
      { icon: "fa-people-group",  title: "Socialize",        text: "You may feel more outgoing. Schedule social events and collaborative work during this phase." },
    ],
    Ovulation: [
      { icon: "fa-fire",          title: "Peak Performance", text: "Energy and strength are at their highest. Push for personal records in workouts." },
      { icon: "fa-apple-whole",   title: "Anti-Inflammatory Foods", text: "Eat fruits, vegetables, and omega-3 rich foods to support your body during this fertile window." },
      { icon: "fa-heart-pulse",   title: "Cardio & Strength", text: "Your body handles high-intensity exercise best now. Great time for challenging cardio sessions." },
      { icon: "fa-comments",      title: "Communication Peak", text: "Verbal skills and confidence tend to peak. Good time for presentations or difficult conversations." },
    ],
    Luteal: [
      { icon: "fa-spa",           title: "Wind Down Gradually", text: "Energy decreases as progesterone rises. Switch to moderate exercise like pilates, swimming, or walking." },
      { icon: "fa-wheat-awn",     title: "Complex Carbs",   text: "Cravings may increase. Choose whole grains, sweet potatoes, and magnesium-rich foods like nuts and seeds." },
      { icon: "fa-moon",          title: "Prioritize Sleep", text: "Progesterone can affect sleep quality. Maintain a consistent bedtime and limit caffeine after noon." },
      { icon: "fa-hand-holding-heart", title: "Self-Care",   text: "PMS symptoms may appear. Journaling, baths, and light stretching can help manage mood changes." },
    ],
  };

  /* ── State ──────────────────────────────────────────── */
  // flowLog[dateStr] = { flow, symptoms[], crampPain, discharge }
  let flowLog = {};
  let viewYear, viewMonth;
  let editingDate = null;

  /* ── Auth Helper ────────────────────────────────────── */
  function getUserId() {
    try {
      const session = localStorage.getItem("sanctuary_session");
      if (session) {
        const parsed = JSON.parse(session);
        return parsed.user_id || null;
      }
      // Also check sessionStorage
      const sessionAlt = sessionStorage.getItem("sanctuary_session");
      if (sessionAlt) {
        const parsed = JSON.parse(sessionAlt);
        return parsed.user_id || null;
      }
    } catch (e) {
      console.error("Error getting user_id:", e);
    }
    return null;
  }

  /* ── Persistence ────────────────────────────────────── */
  function loadFlowLogFromStorage() {
    try {
      const raw = localStorage.getItem(FLOWLOG_KEY);
      if (raw) flowLog = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  function saveFlowLogToStorage() {
    localStorage.setItem(FLOWLOG_KEY, JSON.stringify(flowLog));
  }

  async function loadFlowLogFromAPI() {
    const userId = getUserId();
    if (!userId) {
      // Not logged in, load from localStorage only
      loadFlowLogFromStorage();
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/menstrual/${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.entries && Object.keys(data.entries).length > 0) {
          flowLog = data.entries;
          // Update localStorage as backup
          saveFlowLogToStorage();
        } else {
          // No data in API, check localStorage for migration
          const stored = localStorage.getItem(FLOWLOG_KEY);
          if (stored) {
            flowLog = JSON.parse(stored);
            if (Object.keys(flowLog).length > 0) {
              // Migrate to API
              await saveFlowLogToAPI();
            }
          } else {
            flowLog = {};
          }
        }
      } else if (response.status === 404) {
        // User exists but no menstrual doc - load from localStorage for migration
        loadFlowLogFromStorage();
        if (Object.keys(flowLog).length > 0) {
          await saveFlowLogToAPI();
        }
      } else {
        throw new Error(`API error: ${response.statusText}`);
      }
    } catch (e) {
      console.error("Error loading from API, falling back to localStorage:", e);
      loadFlowLogFromStorage();
    }
  }

  async function saveFlowLogToAPI() {
    const userId = getUserId();
    if (!userId) {
      // Not logged in, save to localStorage only
      saveFlowLogToStorage();
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/menstrual/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: flowLog })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // Also update localStorage as backup
      saveFlowLogToStorage();
      console.log("Flow log saved to API");
    } catch (e) {
      console.error("Error saving to API:", e);
      // Still save to localStorage
      saveFlowLogToStorage();
    }
  }

  // Unified load function (async)
  async function loadFlowLog() {
    await loadFlowLogFromAPI();
  }

  // Unified save function (async)
  async function saveFlowLog() {
    await saveFlowLogToAPI();
  }

  /* ── Date helpers ───────────────────────────────────── */
  function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseDate(str) {
    return new Date(str + "T00:00:00");
  }

  function formatDateLabel(dateStr) {
    const d = parseDate(dateStr);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  /* ── Cycle derivation from flow log ─────────────────── */
  function findLastPeriodStart() {
    const flowDates = Object.keys(flowLog)
      .filter(d => flowLog[d].flow && flowLog[d].flow !== "none")
      .sort();

    if (flowDates.length === 0) return null;

    // Cluster flow dates (gap > 5 days = new period)
    const clusters = [];
    let cluster = [flowDates[flowDates.length - 1]];

    for (let i = flowDates.length - 2; i >= 0; i--) {
      const curr = parseDate(flowDates[i]);
      const next = parseDate(cluster[cluster.length - 1]);
      const diffDays = Math.round((next - curr) / 86400000);
      if (diffDays <= 5) {
        cluster.push(flowDates[i]);
      } else {
        clusters.push(cluster);
        cluster = [flowDates[i]];
      }
    }
    clusters.push(cluster);

    const latest = clusters[0];
    latest.sort();
    return parseDate(latest[0]);
  }

  function getCycleDay(date) {
    const periodStart = findLastPeriodStart();
    if (!periodStart) return null;
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const start = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
    const diffMs = d - start;
    if (diffMs < 0) return null;
    return (Math.floor(diffMs / 86400000) % CYCLE_LENGTH) + 1;
  }

  function getPhase(cycleDay) {
    if (!cycleDay) return null;
    return PHASES.find(p => cycleDay >= p.start && cycleDay <= p.end) || null;
  }

  /* ── Phase ring SVG ─────────────────────────────────── */
  function buildPhaseRing(cycleDay) {
    const size = 120;
    const r = (size - 10) / 2;
    const circ = 2 * Math.PI * r;

    if (!cycleDay) {
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="rgba(0,0,0,0.08)" stroke-width="8" fill="none"/>
      </svg>`;
    }

    let segments = "";
    let accumulated = 0;
    PHASES.forEach(p => {
      const span = p.end - p.start + 1;
      const segLen = (span / CYCLE_LENGTH) * circ;
      const gap = circ - segLen;
      const rotation = (accumulated / CYCLE_LENGTH) * 360 - 90;
      segments += `<circle cx="${size/2}" cy="${size/2}" r="${r}"
        stroke="${p.color}" stroke-width="8" fill="none" stroke-linecap="round"
        stroke-dasharray="${segLen - 2} ${gap + 2}"
        transform="rotate(${rotation} ${size/2} ${size/2})"
        opacity="${cycleDay >= p.start && cycleDay <= p.end ? 1 : 0.25}"/>`;
      accumulated += span;
    });

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="rgba(0,0,0,0.06)" stroke-width="8" fill="none"/>
      ${segments}
    </svg>`;
  }

  /* ── Render: Phase overview ─────────────────────────── */
  function renderPhaseCard() {
    const today = new Date();
    const cycleDay = getCycleDay(today);
    const phase = getPhase(cycleDay);

    $("#cycleRing").innerHTML = buildPhaseRing(cycleDay);

    if (cycleDay && phase) {
      $("#cycleDayNumber").textContent = `Day ${cycleDay}`;
      $("#cyclePhaseName").textContent = `${phase.name} Phase`;
      $("#cyclePhaseRange").textContent = `Days ${phase.start}\u2013${phase.end} of ${CYCLE_LENGTH}`;
    } else {
      $("#cycleDayNumber").textContent = "--";
      $("#cyclePhaseName").textContent = "Tap a day below to start logging";
      $("#cyclePhaseRange").textContent = "";
    }
  }

  /* ── Render: Calendar ───────────────────────────────── */
  function renderCalendar() {
    const label = $("#calMonthLabel");
    const container = $("#calDays");
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    label.textContent = `${months[viewMonth]} ${viewYear}`;

    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = toDateStr(today);

    let html = "";

    for (let i = 0; i < firstDay; i++) {
      html += '<span class="cal-day cal-day-empty"></span>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dateStr = toDateStr(date);
      const isToday = dateStr === todayStr;
      const cycleDay = getCycleDay(date);
      const phase = getPhase(cycleDay);
      const entry = flowLog[dateStr];
      const hasFlow = entry && entry.flow && entry.flow !== "none";
      const hasAnyData = !!entry;

      let cls = "cal-day cal-day-clickable";
      if (isToday) cls += " cal-day-today";
      if (hasFlow) {
        cls += " cal-day-has-flow";
      } else if (hasAnyData) {
        cls += " cal-day-has-data";
      } else if (phase) {
        // Predicted phase background (no logged data for this day)
        cls += ` cal-day-${phase.name.toLowerCase()}`;
      }

      // Dots only for days with actual logged data
      let dots = "";
      if (hasFlow) {
        const count = FLOW_DOTS[entry.flow] || 1;
        for (let f = 0; f < count; f++) {
          dots += '<span class="cal-flow-dot"></span>';
        }
      } else if (hasAnyData) {
        dots = '<span class="cal-data-dot"></span>';
      }

      html += `<span class="${cls}" data-date="${dateStr}">
        <span class="cal-day-num">${d}</span>
        <span class="cal-day-indicators">${dots}</span>
      </span>`;
    }

    container.innerHTML = html;
  }

  /* ── Flow editor: open / close / save ───────────────── */
  function openFlowEditor(dateStr) {
    editingDate = dateStr;
    const overlay = $("#flowEditorOverlay");
    const entry = flowLog[dateStr] || {};

    $("#flowEditorTitle").textContent = formatDateLabel(dateStr);

    // Reset flow buttons
    $$("#flowBtnGroup .flow-btn").forEach(b => b.classList.remove("active"));
    if (entry.flow) {
      const btn = $(`#flowBtnGroup .flow-btn[data-flow="${entry.flow}"]`);
      if (btn) btn.classList.add("active");
    }

    // Reset symptom checkboxes
    $$("#feSymptoms input[type=checkbox]").forEach(cb => {
      cb.checked = entry.symptoms ? entry.symptoms.includes(cb.value) : false;
    });

    // Cramp slider
    const slider = $("#feCrampPain");
    slider.value = entry.crampPain || 0;

    // Reset discharge radios
    $$("#feDischargeGroup input[type=radio]").forEach(r => r.checked = false);
    if (entry.discharge) {
      const radio = $(`#feDischargeGroup input[value="${entry.discharge}"]`);
      if (radio) radio.checked = true;
    }

    // Show delete btn if there's existing data
    const hasData = entry.flow || (entry.symptoms && entry.symptoms.length) || entry.crampPain || entry.discharge;
    $("#flowEditorDelete").style.display = hasData ? "inline-flex" : "none";

    overlay.classList.add("active");
  }

  function closeFlowEditor() {
    $("#flowEditorOverlay").classList.remove("active");
    editingDate = null;
  }

  async function saveFlowEntry() {
    if (!editingDate) return;

    const flowBtn = $("#flowBtnGroup .flow-btn.active");
    const flow = flowBtn ? flowBtn.dataset.flow : null;

    const symptoms = $$("#feSymptoms input:checked").map(cb => cb.value);

    const crampPain = Number($("#feCrampPain").value) || 0;

    const dischargeRadio = $("#feDischargeGroup input[type=radio]:checked");
    const discharge = dischargeRadio ? dischargeRadio.value : null;

    // Only save if something was entered
    const isEmpty = !flow && symptoms.length === 0 && crampPain === 0 && !discharge;

    if (isEmpty) {
      delete flowLog[editingDate];
    } else {
      flowLog[editingDate] = {};
      if (flow) flowLog[editingDate].flow = flow;
      if (symptoms.length) flowLog[editingDate].symptoms = symptoms;
      if (crampPain > 0) flowLog[editingDate].crampPain = crampPain;
      if (discharge) flowLog[editingDate].discharge = discharge;
    }

    await saveFlowLog();
    // Invalidate Benji recommendations cache when flow data changes
    clearBenjiCache();
    closeFlowEditor();
    renderAll();
  }

  async function deleteFlowEntry() {
    if (!editingDate) return;
    delete flowLog[editingDate];
    await saveFlowLog();
    // Invalidate Benji recommendations cache when flow data changes
    clearBenjiCache();
    closeFlowEditor();
    renderAll();
  }

  /* ── 7-Day Flow Reminder ───────────────────────────── */
  const REMINDER_DISMISSED_KEY = "Benji_flowReminderDismissed";

  function checkFlowReminder() {
    const banner = $("#flowReminderBanner");
    if (!banner) return;

    // Don't show if dismissed for this period cluster
    const dismissed = localStorage.getItem(REMINDER_DISMISSED_KEY);

    const periodStart = findLastPeriodStart();
    if (!periodStart) { banner.style.display = "none"; return; }

    const periodStartStr = toDateStr(periodStart);

    // If user already dismissed for this specific period, skip
    if (dismissed === periodStartStr) { banner.style.display = "none"; return; }

    // Count consecutive flow days from the period start
    let consecutiveDays = 0;
    const d = new Date(periodStart);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (d <= today) {
      const ds = toDateStr(d);
      const entry = flowLog[ds];
      if (entry && entry.flow && entry.flow !== "none") {
        consecutiveDays++;
      } else {
        break; // gap found, stop counting
      }
      d.setDate(d.getDate() + 1);
    }

    if (consecutiveDays >= 7) {
      banner.style.display = "block";
    } else {
      banner.style.display = "none";
    }
  }

  function dismissFlowReminder() {
    const periodStart = findLastPeriodStart();
    if (periodStart) {
      localStorage.setItem(REMINDER_DISMISSED_KEY, toDateStr(periodStart));
    }
    const banner = $("#flowReminderBanner");
    if (banner) banner.style.display = "none";
  }

  /* ── Render: Recommendations ────────────────────────── */
  function renderRecommendations() {
    const today = new Date();
    const cycleDay = getCycleDay(today);
    const phase = getPhase(cycleDay);

    const title = $("#recTitle");
    const grid = $("#recGrid");

    if (!phase) {
      title.textContent = "Phase Recommendations";
      grid.innerHTML = '<p class="checkin-hint">Log your flow on the calendar above so Benji can determine your cycle phase and show recommendations.</p>';
      return;
    }

    title.textContent = `${phase.name} Phase Recommendations`;
    const recs = RECOMMENDATIONS[phase.name] || [];

    grid.innerHTML = recs.map(r => `
      <div class="cycle-rec-card" style="border-left: 3px solid ${phase.color}">
        <div class="cycle-rec-icon"><i class="fa-solid ${r.icon}"></i></div>
        <div class="cycle-rec-body">
          <strong class="cycle-rec-title">${r.title}</strong>
          <p class="cycle-rec-text">${r.text}</p>
        </div>
      </div>
    `).join("");
  }

  /* ── Benji Recommendations (AI-powered) ────────────── */
  let benjiRecsLoading = false;

  function displayBenjiRecommendations(data) {
    const predictionLine = $("#cyclePredictionLine");
    const benjiNotes = $("#benjiNotes");
    const benjiNotesText = $("#benjiNotesText");
    const benjiCurrentPhase = $("#benjiCurrentPhase");
    const benjiCycleDay = $("#benjiCycleDay");
    const benjiPredictedOnset = $("#benjiPredictedOnset");
    const recGrid = $("#recGrid");

    // Show prediction line if we have phase or prediction data
    if (data.current_phase || data.predicted_period_onset) {
      benjiCurrentPhase.textContent = data.current_phase || "—";
      benjiCycleDay.textContent = data.cycle_day || "—";
      benjiPredictedOnset.textContent = data.predicted_period_onset || "—";
      predictionLine.style.display = "flex";
    } else {
      predictionLine.style.display = "none";
    }

    // Show Benji's Note if we have personalization notes
    if (data.personalization_notes) {
      benjiNotesText.textContent = data.personalization_notes;
      benjiNotes.style.display = "block";
    } else {
      benjiNotes.style.display = "none";
    }

    // Update recommendations grid if AI recommendations provided
    if (data.recommendations && data.recommendations.length > 0) {
      // Get phase color for styling
      const phase = getPhase(getCycleDay(new Date()));
      const phaseColor = phase ? phase.color : "#4fc193";

      recGrid.innerHTML = data.recommendations.map(r => `
        <div class="cycle-rec-card" style="border-left: 3px solid ${phaseColor}">
          <div class="cycle-rec-icon"><i class="fa-solid ${r.icon || 'fa-heart-pulse'}"></i></div>
          <div class="cycle-rec-body">
            <strong class="cycle-rec-title">${r.title}</strong>
            <p class="cycle-rec-text">${r.text}</p>
          </div>
        </div>
      `).join("");
    }
  }

  function hideBenjiUI() {
    const predictionLine = $("#cyclePredictionLine");
    const benjiNotes = $("#benjiNotes");
    if (predictionLine) predictionLine.style.display = "none";
    if (benjiNotes) benjiNotes.style.display = "none";
  }

  async function fetchBenjiRecommendations(forceRefresh = false) {
    const userId = getUserId();
    const benjiRecsBtn = $("#benjiRecsBtn");

    // Must be logged in
    if (!userId) {
      alert("Please log in to get Benji's personalized recommendations.");
      return;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh && window.BenjiAPI && window.BenjiAPI.getCachedCycleRecommendations) {
      const cached = window.BenjiAPI.getCachedCycleRecommendations(userId);
      if (cached && cached.personalization_notes) {
        displayBenjiRecommendations(cached);
        return;
      }
    }

    // Show loading state
    if (benjiRecsLoading) return;
    benjiRecsLoading = true;
    if (benjiRecsBtn) {
      benjiRecsBtn.disabled = true;
      benjiRecsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Loading...</span>';
    }

    try {
      const response = await fetch(`${BACKEND_URL}/menstrual-recommendations/${userId}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache the response
      if (window.BenjiAPI && window.BenjiAPI.setCachedCycleRecommendations) {
        window.BenjiAPI.setCachedCycleRecommendations(userId, data);
      }

      // Display the data
      displayBenjiRecommendations(data);

    } catch (e) {
      console.error("Error fetching Benji recommendations:", e);
      // Show error in Benji's Note
      const benjiNotes = $("#benjiNotes");
      const benjiNotesText = $("#benjiNotesText");
      if (benjiNotes && benjiNotesText) {
        benjiNotesText.textContent = "I couldn't load personalized recommendations right now. Please try again later.";
        benjiNotes.style.display = "block";
      }
    } finally {
      benjiRecsLoading = false;
      if (benjiRecsBtn) {
        benjiRecsBtn.disabled = false;
        benjiRecsBtn.innerHTML = '<i class="fas fa-magic"></i> <span>Get Benji\'s Recommendations</span>';
      }
    }
  }

  function clearBenjiCache() {
    const userId = getUserId();
    if (userId && window.BenjiAPI && window.BenjiAPI.clearCachedCycleRecommendations) {
      window.BenjiAPI.clearCachedCycleRecommendations(userId);
    }
  }

  /* ── Event listeners ────────────────────────────────── */
  async function init() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();

    await loadFlowLog();

    // Calendar nav
    $("#calPrev").addEventListener("click", () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      renderCalendar();
    });
    $("#calNext").addEventListener("click", () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      renderCalendar();
    });

    // Calendar day clicks
    $("#calDays").addEventListener("click", (e) => {
      const dayEl = e.target.closest(".cal-day-clickable");
      if (!dayEl) return;
      const dateStr = dayEl.dataset.date;
      if (dateStr) openFlowEditor(dateStr);
    });

    // Flow button group (single-select)
    $("#flowBtnGroup").addEventListener("click", (e) => {
      const btn = e.target.closest(".flow-btn");
      if (!btn) return;
      $$("#flowBtnGroup .flow-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });

    // (Discharge now uses radio buttons — no JS needed for single-select)

    // "Everything is fine" unchecks others; any other uncheck "fine"
    $$("#feSymptoms input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => {
        if (cb.value === "fine" && cb.checked) {
          $$("#feSymptoms input[type=checkbox]").forEach(o => {
            if (o !== cb) o.checked = false;
          });
        } else if (cb.value !== "fine" && cb.checked) {
          const fine = $("#feSymptoms input[value=fine]");
          if (fine) fine.checked = false;
        }
      });
    });

    // Flow reminder dismiss
    const dismissBtn = $("#flowReminderDismiss");
    if (dismissBtn) dismissBtn.addEventListener("click", dismissFlowReminder);

    // Benji recommendations button
    const benjiRecsBtn = $("#benjiRecsBtn");
    if (benjiRecsBtn) {
      benjiRecsBtn.addEventListener("click", () => fetchBenjiRecommendations(true));
    }

    // Load cached Benji recommendations if available
    const userId = getUserId();
    if (userId && window.BenjiAPI && window.BenjiAPI.getCachedCycleRecommendations) {
      const cached = window.BenjiAPI.getCachedCycleRecommendations(userId);
      if (cached && cached.personalization_notes) {
        displayBenjiRecommendations(cached);
      }
    }

    // Save / delete / close
    $("#flowEditorSave").addEventListener("click", saveFlowEntry);
    $("#flowEditorDelete").addEventListener("click", deleteFlowEntry);
    $("#flowEditorClose").addEventListener("click", closeFlowEditor);

    $("#flowEditorOverlay").addEventListener("click", (e) => {
      if (e.target === $("#flowEditorOverlay")) closeFlowEditor();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && $("#flowEditorOverlay").classList.contains("active")) {
        closeFlowEditor();
      }
    });

    renderAll();
  }

  function renderAll() {
    renderPhaseCard();
    renderCalendar();
    renderRecommendations();
    checkFlowReminder();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
