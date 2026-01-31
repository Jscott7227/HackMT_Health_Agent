/* ============================================================
   HOME DASHBOARD – renders all sections with faux data
   (will be replaced with real API data later)
   ============================================================ */
(function () {
  "use strict";

  /* ---------- FAUX DATA ---------- */

  /*
   * Each goal maps 1-to-1 with a DB row.
   * Replace this array with a fetch() call later:
   *   GET /api/users/:id/goals → [{ id, label, specific, measurable, ... }]
   */
  var fauxGoals = [
    {
      id: "goal_001",
      label: "Lose 10 lbs",
      specific: "Reduce body fat through caloric deficit + cardio",
      measurable: "10 lbs lost",
      currentValue: 3.8,          // lbs lost so far
      targetValue: 10,            // lbs to lose
      unit: "lbs",
      progressPct: 38,            // server-computed or derived
      weekCurrent: 3,
      weekTotal: 10,
      startDate: "2025-01-13",
      endDate: "2025-03-24",
      color: "#3a7d44"
    },
    {
      id: "goal_002",
      label: "Build Upper Body Strength",
      specific: "Increase bench press from 135 to 185 lbs",
      measurable: "+50 lbs bench",
      currentValue: 25,
      targetValue: 50,
      unit: "lbs",
      progressPct: 50,
      weekCurrent: 5,
      weekTotal: 12,
      startDate: "2024-12-30",
      endDate: "2025-03-24",
      color: "#5a9a64"
    },
    {
      id: "goal_003",
      label: "Run a 5K",
      specific: "Train from couch to 5K race-ready",
      measurable: "5K in under 30 min",
      currentValue: 2.1,
      targetValue: 5,
      unit: "km",
      progressPct: 42,
      weekCurrent: 2,
      weekTotal: 8,
      startDate: "2025-01-20",
      endDate: "2025-03-17",
      color: "#7ab884"
    }
  ];

  var fauxGlance = [
    { icon: "🔥", label: "Calories",   value: "1,820 / 2,200" },
    { icon: "💧", label: "Water",      value: "6 / 8 cups" },
    { icon: "🏋️", label: "Workout",   value: "Upper Body – done" },
    { icon: "😴", label: "Sleep",      value: "7.2 hrs" }
  ];

  var fauxPreview = [
    { day: "Today",    items: ["Upper Body Strength", "20 min walk", "Stretch routine"] },
    { day: "Tomorrow", items: ["Lower Body Strength", "Yoga flow", "Meal prep day"] }
  ];

  var fauxTimeline = [
    { label: "Mon", fitness: 80, wellness: 70 },
    { label: "Tue", fitness: 65, wellness: 75 },
    { label: "Wed", fitness: 90, wellness: 60 },
    { label: "Thu", fitness: 50, wellness: 85 },
    { label: "Fri", fitness: 75, wellness: 72 },
    { label: "Sat", fitness: 40, wellness: 90 },
    { label: "Sun", fitness: 0,  wellness: 0  }
  ];

  var fauxTrend = [
    { day: "Yesterday",     sleep: 6.8, energy: 3, mood: 4, workout: "Cardio 30 min" },
    { day: "2 days ago",    sleep: 7.5, energy: 4, mood: 4, workout: "Upper Body" },
    { day: "3 days ago",    sleep: 5.9, energy: 2, mood: 3, workout: "Rest day" }
  ];

  var fauxAgentNotes = [
    "Sleep has been trending down — consider an earlier wind-down routine.",
    "Energy was low on days following poor sleep. Try limiting screen time before bed.",
    "Great consistency with workouts this week!"
  ];

  /* Recovery day – set to false for normal view, true to test recovery card */
  var isRecoveryDay = false;
  var recoveryMessage = "Your body needs rest today. Focus on hydration, light stretching, and getting quality sleep tonight.";
  var recoveryTips = ["Foam roll for 10 minutes", "Drink at least 8 cups of water", "Go for a gentle 15-min walk"];

  /* Injury / soreness warnings – set to null to hide */
  var injuryWarning = null; // e.g. "You reported knee soreness yesterday. Avoid heavy leg exercises today."

  /* Whether today's check-in is completed */
  var checkinDone = false;

  /* ---------- HELPERS ---------- */

  function el(id) { return document.getElementById(id); }

  function buildSVGRing(pct, color, size) {
    var r = (size - 8) / 2;
    var circ = 2 * Math.PI * r;
    var offset = circ - (pct / 100) * circ;
    return (
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '">' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" ' +
          'stroke="rgba(0,0,0,0.08)" stroke-width="6" fill="none"/>' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" ' +
          'stroke="' + color + '" stroke-width="6" fill="none" ' +
          'stroke-linecap="round" ' +
          'stroke-dasharray="' + circ + '" ' +
          'stroke-dashoffset="' + offset + '" ' +
          'transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/>' +
      '</svg>'
    );
  }

  /* ---------- RENDER: CHECK-IN BANNER ---------- */
  function renderBanner() {
    var banner = el("checkinBanner");
    if (!banner) return;
    banner.style.display = checkinDone ? "none" : "flex";
  }

  /* ---------- RENDER: RECOVERY CARD ---------- */
  function renderRecovery() {
    var card = el("recoveryCard");
    if (!card) return;
    if (!isRecoveryDay) { card.style.display = "none"; return; }
    card.style.display = "block";
    el("recoveryMessage").textContent = recoveryMessage;
    var tipsEl = el("recoveryTips");
    var html = "<ul>";
    for (var i = 0; i < recoveryTips.length; i++) {
      html += "<li>" + recoveryTips[i] + "</li>";
    }
    html += "</ul>";
    tipsEl.innerHTML = html;
  }

  /* ---------- RENDER: INJURY WARNING ---------- */
  function renderInjuryWarning() {
    var card = el("injuryWarning");
    if (!card) return;
    if (!injuryWarning) { card.style.display = "none"; return; }
    card.style.display = "flex";
    el("injuryWarningText").innerHTML = "<p>" + injuryWarning + "</p>";
  }

  /* ---------- RENDER: TODAY AT A GLANCE ---------- */
  function renderGlance() {
    var section = el("glanceSection");
    var grid = el("glanceGrid");
    if (!section || !grid) return;
    if (!checkinDone) { section.style.display = "none"; return; }
    section.style.display = "block";
    var html = "";
    for (var i = 0; i < fauxGlance.length; i++) {
      var g = fauxGlance[i];
      html +=
        '<div class="glance-card">' +
          '<span class="glance-icon">' + g.icon + '</span>' +
          '<span class="glance-label">' + g.label + '</span>' +
          '<span class="glance-value">' + g.value + '</span>' +
        '</div>';
    }
    grid.innerHTML = html;
  }

  /* ---------- HELPERS: date formatting ---------- */
  function shortDate(iso) {
    var d = new Date(iso + "T00:00:00");
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[d.getMonth()] + " " + d.getDate();
  }

  /* ---------- RENDER: GOAL PROGRESS RINGS ---------- */
  function renderGoals() {
    var grid = el("goalsRingGrid");
    if (!grid) return;
    var html = "";
    for (var i = 0; i < fauxGoals.length; i++) {
      var g = fauxGoals[i];
      var pct = Math.min(100, Math.max(0, g.progressPct));
      var weeksLeft = g.weekTotal - g.weekCurrent;
      html +=
        '<div class="goal-ring-card" data-goal-id="' + g.id + '">' +
          '<div class="ring-wrap">' +
            buildSVGRing(pct, g.color, 110) +
            '<div class="ring-inner-label">' +
              '<span class="ring-pct">' + pct + '%</span>' +
              '<span class="ring-progress">' + g.currentValue + ' / ' + g.targetValue + ' ' + g.unit + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="ring-meta">' +
            '<strong>' + g.label + '</strong>' +
            '<span class="ring-measurable">' + g.currentValue + ' / ' + g.targetValue + ' ' + g.unit + '</span>' +
            '<span class="ring-timeline">Week ' + g.weekCurrent + ' of ' + g.weekTotal + '</span>' +
            '<span class="ring-dates">' + shortDate(g.startDate) + ' — ' + shortDate(g.endDate) + '</span>' +
            '<span class="ring-remaining">' + weeksLeft + ' week' + (weeksLeft !== 1 ? 's' : '') + ' remaining</span>' +
          '</div>' +
        '</div>';
    }
    grid.innerHTML = html;
  }

  /* ---------- RENDER: TODAY / TOMORROW PREVIEW ---------- */
  function renderPreview() {
    var container = el("previewCards");
    if (!container) return;
    var html = "";
    for (var i = 0; i < fauxPreview.length; i++) {
      var p = fauxPreview[i];
      html += '<div class="preview-card">';
      html += '<h3>' + p.day + '</h3><ul>';
      for (var j = 0; j < p.items.length; j++) {
        html += '<li>' + p.items[j] + '</li>';
      }
      html += '</ul></div>';
    }
    container.innerHTML = html;
  }

  /* ---------- RENDER: TIMELINE BARS ---------- */
  function renderTimeline() {
    var container = el("timelineBars");
    if (!container) return;
    var html = '<div class="timeline-legend">' +
      '<span class="legend-dot fitness-dot"></span> Fitness ' +
      '<span class="legend-dot wellness-dot"></span> Wellness' +
      '</div>';
    html += '<div class="timeline-chart">';
    for (var i = 0; i < fauxTimeline.length; i++) {
      var t = fauxTimeline[i];
      html +=
        '<div class="timeline-col">' +
          '<div class="timeline-bar-group">' +
            '<div class="timeline-bar fitness-bar" style="height:' + t.fitness + '%"></div>' +
            '<div class="timeline-bar wellness-bar" style="height:' + t.wellness + '%"></div>' +
          '</div>' +
          '<span class="timeline-label">' + t.label + '</span>' +
        '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  /* ---------- RENDER: 3-DAY TREND ---------- */
  function renderTrend() {
    var cardsEl = el("trendCards");
    var notesEl = el("trendAgentNotes");
    if (!cardsEl) return;

    var html = "";
    for (var i = 0; i < fauxTrend.length; i++) {
      var t = fauxTrend[i];
      html +=
        '<div class="trend-card">' +
          '<h4>' + t.day + '</h4>' +
          '<div class="trend-row"><span>Sleep</span><span>' + t.sleep + ' hrs</span></div>' +
          '<div class="trend-row"><span>Energy</span><span>' + t.energy + ' / 5</span></div>' +
          '<div class="trend-row"><span>Mood</span><span>' + t.mood + ' / 5</span></div>' +
          '<div class="trend-row"><span>Workout</span><span>' + t.workout + '</span></div>' +
        '</div>';
    }
    cardsEl.innerHTML = html;

    if (notesEl && fauxAgentNotes.length) {
      var nhtml = '<h4>Benji\'s Notes</h4><ul>';
      for (var j = 0; j < fauxAgentNotes.length; j++) {
        nhtml += '<li>' + fauxAgentNotes[j] + '</li>';
      }
      nhtml += '</ul>';
      notesEl.innerHTML = nhtml;
    }
  }

  /* ---------- CHECK-IN MODAL ---------- */
  function initCheckinModal() {
    var modal = document.getElementById("checkinModal");
    var openBtn = document.getElementById("openCheckinBtn");
    var closeBtn = document.getElementById("closeCheckinBtn");
    if (!modal) return;

    function openModal() {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
    function closeModal() {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }

    if (openBtn) openBtn.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    // Close on backdrop click
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });

    // Close on Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("active")) closeModal();
    });

    // Expose for check-in.js to call after successful submit
    window.BenjiCheckinModal = { close: closeModal };
  }

  /* ---------- INIT ---------- */
  function initDashboard() {
    renderBanner();
    renderRecovery();
    renderInjuryWarning();
    renderGlance();
    renderGoals();
    renderPreview();
    renderTimeline();
    renderTrend();
    initCheckinModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboard);
  } else {
    initDashboard();
  }
})();
