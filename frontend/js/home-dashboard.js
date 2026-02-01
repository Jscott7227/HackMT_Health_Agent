/* ============================================================
   HOME DASHBOARD – renders all sections; loads goals from API when available
   ============================================================ */
(function () {
  "use strict";

  /* ---------- GOALS DATA (loaded from backend API) ---------- */

  /*
   * Each goal maps 1-to-1 with a DB row.
   * When window.BenjiAPI and session exist, we fetch GET /goals/:id and use accepted goals for rings.
   * Starts empty - populated from backend in runInit()
   */
  var fauxGoals = [];



  /* Recovery day – set to false for normal view, true to test recovery card */
  var isRecoveryDay = false;
  var recoveryMessage = "Your body needs rest today. Focus on hydration, light stretching, and getting quality sleep tonight.";
  var recoveryTips = ["Foam roll for 10 minutes", "Drink at least 8 cups of water", "Go for a gentle 15-min walk"];

  /* Injury / soreness warnings – set to null to hide */
  var injuryWarning = null; // e.g. "You reported knee soreness yesterday. Avoid heavy leg exercises today."

  /* Whether today's check-in is completed */
  var checkinDone = false;

  /* Store today's check-in data (if available) for rendering glance */
  var todayCheckinData = null;

  /* Hardcoded last 7 days (excluding today) for demo graphs; values 0-5 */
  var fauxHistory = {
    feeling:   [3, 4, 3, 5, 4, 2, 1],
    nutrition: [3, 4, 2, 5, 4, 3, 1],
    drink:     [4, 4, 3, 5, 4, 2, 1],
    sleep:     [5, 4, 3, 5, 4, 3, 5]
  };

  /* Store Benji's Notes from post check-in sensing */
  var benjiNotesData = null;

  /* Helper: Check if a date string or timestamp is "today" (same calendar day) */
  function isToday(dateValue) {
    if (!dateValue) return false;
    var d;
    if (typeof dateValue === 'string') {
      d = new Date(dateValue);
    } else if (dateValue.seconds) {
      d = new Date(dateValue.seconds * 1000);
    } else if (dateValue._seconds) {
      d = new Date(dateValue._seconds * 1000);
    } else {
      d = new Date(dateValue);
    }
    if (isNaN(d.getTime())) return false;
    var now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  }

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
    // Always show the banner so users can reopen / edit check-ins anytime
    banner.style.display = "flex";
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

  /* ---------- RENDER: Week at a Glance ---------- */
  function renderGlance() {
    var section = el("glanceSection");
    var header = el("glanceHeading");
    var grid = el("glanceGrid");
    if (header) header.textContent = "Week at a Glance";
    if (!section || !grid) return;

    // Use today's data if present, else rely on fauxHistory for demo
    function toFive(val, max) {
      if (val == null) return null;
      var n = Number(val);
      if (isNaN(n)) return null;
      if (max && max > 0) return Math.round((n / max) * 5);
      return n;
    }
    var todayFeelingRaw = todayCheckinData ? (todayCheckinData.dayScore || 0) : null;
    var todayFeeling   = todayCheckinData ? toFive(todayFeelingRaw, 10) : null;
    var todayNutrition = todayCheckinData ? (todayCheckinData.eatScore || 0) : null;
    var todayDrink     = todayCheckinData ? (todayCheckinData.drinkScore || 0) : null;
    var todaySleep     = todayCheckinData ? (todayCheckinData.sleepScore || 0) : null;

    function bars(values, todayVal) {
      var arr = (values || []).slice(-6); // past 6 days
      // add today's value (may be null) to make 7 slots
      arr.push(todayVal != null ? todayVal : 0);
      return arr;
    }

    var cards = [
      { label: "Feeling",   values: bars(fauxHistory.feeling,   todayFeeling) },
      { label: "Nutrition", values: bars(fauxHistory.nutrition, todayNutrition) },
      { label: "Drink",     values: bars(fauxHistory.drink,     todayDrink) },
      { label: "Sleep",     values: bars(fauxHistory.sleep,     todaySleep) }
    ];

    section.style.display = "block";
    var html = "";
    cards.forEach(function (c) {
      var barsHtml = c.values.map(function (v) {
        var pct = Math.max(0, Math.min(5, v)) / 5 * 100;
        return '<div class="spark-bar" style="height:' + (pct || 2) + '%"></div>';
      }).join("");
      var todayVal = c.values[c.values.length-1] || 0;
      var todayLabel;
      if (!todayCheckinData) {
        todayLabel = "Please complete";
      } else if (c.label === "Feeling" && todayFeelingRaw != null) {
        todayLabel = todayFeelingRaw + "/10";
      } else {
        todayLabel = todayVal + "/5";
      }
      html +=
        '<div class="glance-card">' +
          '<div class="glance-label-row"><span class="glance-label">' + c.label + '</span></div>' +
          '<div class="sparkline">' + barsHtml + '</div>' +
          '<div class="glance-value">Today: ' + todayLabel + '</div>' +
        '</div>';
    });
    grid.innerHTML = html;
  }

  /* ---------- RENDER: BENJI'S NOTES (post check-in insights) ---------- */
  function renderBenjiNotes() {
    var section = el("benjiNotesSection");
    var container = el("benjiNotesContent");
    if (!section || !container) return;
    
    // Only show if we have notes
    if (!benjiNotesData || !Array.isArray(benjiNotesData) || benjiNotesData.length === 0) {
      section.style.display = "none";
      return;
    }
    
    section.style.display = "block";
    var html = '<ul class="benji-notes-list">';
    for (var i = 0; i < benjiNotesData.length; i++) {
      html += '<li>' + escapeHtml(benjiNotesData[i]) + '</li>';
    }
    html += '</ul>';
    container.innerHTML = html;
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

    if (fauxGoals.length === 0) {
      grid.style.display = "flex";
      grid.style.flexDirection = "column";
      grid.style.alignItems = "center";
      grid.style.justifyContent = "center";
      grid.style.minHeight = "220px";
      grid.innerHTML = '<div class="no-goals-message" style="' +
        'display: flex; ' +
        'flex-direction: column; ' +
        'align-items: center; ' +
        'justify-content: center; ' +
        'padding: 4rem 2rem; ' +
        'text-align: center; ' +
        'background: linear-gradient(135deg, rgba(255, 249, 240, 0.5), rgba(230, 245, 239, 0.5)); ' +
        'border-radius: 16px; ' +
        'border: 2px dashed rgba(1, 104, 68, 0.2); ' +
        'margin: 2rem 0; ' +
      '">' +
        '<div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.6;"></div>' +
        '<h3 style="font-size: 1.5rem; font-weight: 600; color: var(--clay-800); margin-bottom: 0.75rem; font-family: var(--font-display);">No goals yet</h3>' +
        '<p style="font-size: 1rem; color: var(--text-secondary); max-width: 400px; line-height: 1.5;">Visit the <a href="journal.html" style="color: var(--sage); font-weight: 600; text-decoration: underline;">Journal page</a> to set up your wellness and fitness goals.</p>' +
      '</div>';
      return;
    }

    // restore default flex layout for cards
    grid.style.display = "";
    grid.style.flexDirection = "";
    grid.style.alignItems = "";
    grid.style.justifyContent = "";
    grid.style.minHeight = "";

    var html = "";
    for (var i = 0; i < fauxGoals.length; i++) {
      var g = fauxGoals[i];
      var pct = Math.min(100, Math.max(0, g.progressPct));
      var weeksLeft = Math.max(0, g.weekTotal - g.weekCurrent);

      var typeIcon = g.type === 'fitness' ? '' : '';
      var typeBadge = '<span class="goal-type-badge" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; background: rgba(0,0,0,0.05); border-radius: 4px; margin-bottom: 0.5rem; display: inline-block;">' +
        typeIcon + ' ' + (g.type || 'wellness').charAt(0).toUpperCase() + (g.type || 'wellness').slice(1) +
      '</span>';

      html +=
        '<div class="goal-ring-card" data-goal-index="' + i + '" data-goal-id="' + g.id + '" data-goal-type="' + (g.type || 'wellness') + '" style="cursor: pointer;">' +
          '<div class="ring-wrap">' +
            buildSVGRing(pct, g.color, 110) +
            '<div class="ring-inner-label">' +
              '<span class="ring-pct">' + pct + '%</span>' +
              '<span class="ring-progress">' + g.currentValue + ' / ' + g.targetValue + ' ' + g.unit + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="ring-meta">' +
            typeBadge +
            '<strong>' + escapeHtml(g.label) + '</strong>' +
            '<span class="ring-measurable">' + escapeHtml(g.measurable) + '</span>' +
            '<span class="ring-timeline">Week ' + g.weekCurrent + ' of ' + g.weekTotal + '</span>' +
            '<span class="ring-dates">' + shortDate(g.startDate) + ' — ' + shortDate(g.endDate) + '</span>' +
            '<span class="ring-remaining">' + weeksLeft + ' week' + (weeksLeft !== 1 ? 's' : '') + ' remaining</span>' +
          '</div>' +
        '</div>';
    }
    grid.innerHTML = html;

    // Add click handlers to goal cards - navigate to targetedgoal.html
    var cards = grid.querySelectorAll('.goal-ring-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function() {
        var goalIndex = parseInt(this.getAttribute('data-goal-index'));
        if (goalIndex >= 0 && goalIndex < fauxGoals.length) {
          // Store goal in sessionStorage and navigate to targeted goal page
          sessionStorage.setItem("selected_goal", JSON.stringify(fauxGoals[goalIndex]));
          window.location.href = "targetedgoal.html";
        }
      });
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
    window.BenjiCheckinModal = {
      close: closeModal,
      // Called by check-in.js after successful check-in submit
      // checkinData: the check-in payload, benjiNotes: array of "Benji's Notes" strings
      onComplete: function (checkinData, benjiNotes) {
        checkinDone = true;
        todayCheckinData = checkinData || null;
        benjiNotesData = benjiNotes || null;
        console.log("Check-in completed, updating banner, glance, and notes");
        renderBanner();
        renderGlance();
        renderBenjiNotes();
        closeModal();
      }
    };
  }


  /* ---------- RENDER: MEDICATION SCHEDULE (generalized plan) ---------- */
  var medicationScheduleData = null;

  function renderMedicationSchedule() {
    var section = el("medicationScheduleSection");
    var container = el("homeMedicationSchedule");
    if (!section || !container) return;

    if (!medicationScheduleData) {
      section.style.display = "none";
      return;
    }

    var schedule = medicationScheduleData;
    var timeSlots = schedule.timeSlots || {};
    var timeSlotsDetailed = schedule.timeSlotsDetailed || [];
    var foodInstructions = schedule.foodInstructions || [];
    var warnings = schedule.warnings || [];
    var personalizationNotes = schedule.personalizationNotes || null;

    // Check if we have any medications to display
    var hasDetailedSlots = timeSlotsDetailed && timeSlotsDetailed.length > 0;
    var hasScheduledMeds = hasDetailedSlots || Object.keys(timeSlots).some(function (k) {
      return timeSlots[k] && timeSlots[k].length > 0;
    });

    if (!hasScheduledMeds) {
      section.style.display = "none";
      return;
    }

    // Show the section
    section.style.display = "block";

    var timeSlotsHtml = '';

    // Use timeSlotsDetailed when available (AI schedule with explicit times)
    if (hasDetailedSlots) {
      timeSlotsHtml = '<div class="schedule-time-slots">';
      for (var i = 0; i < timeSlotsDetailed.length; i++) {
        var entry = timeSlotsDetailed[i];
        var meds = entry.medications || [];
        if (meds.length === 0) continue;

        var medsHtml = "";
        for (var j = 0; j < meds.length; j++) {
          medsHtml += "<li>" + escapeHtml(meds[j]) + "</li>";
        }

        // Get icon based on time
        var timeIcon = getTimeIcon(entry.time || "08:00");

        // Build food note if present
        var foodNoteHtml = "";
        if (entry.foodNote) {
          foodNoteHtml = '<div class="time-slot-food-note"><i class="fas fa-utensils"></i> ' + escapeHtml(entry.foodNote) + '</div>';
        }

        timeSlotsHtml += '<div class="schedule-time-slot">' +
          '<div class="time-slot-header">' +
            timeIcon + ' <span>' + escapeHtml(entry.label || entry.time) + '</span>' +
          '</div>' +
          '<ul class="time-slot-meds">' + medsHtml + '</ul>' +
          foodNoteHtml +
        '</div>';
      }
      timeSlotsHtml += '</div>';
    } else {
      // Fallback to standard 4-slot display (morning, afternoon, evening, night)
      var timeSlotIcons = {
        morning: '<i class="fas fa-sun" style="color: #f59e0b;"></i>',
        afternoon: '<i class="fas fa-cloud-sun" style="color: #3b82f6;"></i>',
        evening: '<i class="fas fa-moon" style="color: #8b5cf6;"></i>',
        night: '<i class="fas fa-star" style="color: #6366f1;"></i>'
      };
      var timeSlotLabels = {
        morning: "Morning",
        afternoon: "Afternoon",
        evening: "Evening",
        night: "Night"
      };

      timeSlotsHtml = '<div class="schedule-time-slots">';
      var slotOrder = ["morning", "afternoon", "evening", "night"];
      for (var i = 0; i < slotOrder.length; i++) {
        var slot = slotOrder[i];
        var meds = timeSlots[slot] || [];
        if (meds.length > 0) {
          var medsHtml = "";
          for (var j = 0; j < meds.length; j++) {
            medsHtml += "<li>" + escapeHtml(meds[j]) + "</li>";
          }
          timeSlotsHtml += '<div class="schedule-time-slot">' +
            '<div class="time-slot-header">' +
              (timeSlotIcons[slot] || "") + " <span>" + timeSlotLabels[slot] + "</span>" +
            '</div>' +
            '<ul class="time-slot-meds">' + medsHtml + '</ul>' +
          '</div>';
        }
      }
      timeSlotsHtml += '</div>';
    }

    // Build personalization notes HTML (Benji's note for AI schedule)
    var personalizationHtml = "";
    if (personalizationNotes) {
      personalizationHtml = '<div class="schedule-section personalization-notes-home">' +
        '<h4 class="schedule-section-title"><i class="fas fa-lightbulb"></i> Benji\'s Note</h4>' +
        '<p>' + escapeHtml(personalizationNotes) + '</p>' +
      '</div>';
    }

    // Build food instructions HTML
    var foodHtml = "";
    if (foodInstructions.length > 0) {
      var foodItems = "";
      for (var f = 0; f < foodInstructions.length; f++) {
        foodItems += "<li>" + escapeHtml(foodInstructions[f]) + "</li>";
      }
      foodHtml = '<div class="schedule-section">' +
        '<h4 class="schedule-section-title"><i class="fas fa-utensils"></i> Food Instructions</h4>' +
        '<ul class="schedule-list">' + foodItems + '</ul>' +
      '</div>';
    }

    // Build warnings HTML
    var warningsHtml = "";
    if (warnings.length > 0) {
      var hasWarning = warnings.some(function (w) {
        return w.indexOf("CAUTION") >= 0 || w.indexOf("WARNING") >= 0;
      });
      var warningClass = hasWarning ? "schedule-warnings" : "schedule-tips";
      var warningIcon = hasWarning ? "fa-exclamation-triangle" : "fa-info-circle";
      var warningItems = "";
      for (var w = 0; w < warnings.length; w++) {
        warningItems += "<li>" + escapeHtml(warnings[w]) + "</li>";
      }
      warningsHtml = '<div class="schedule-section ' + warningClass + '">' +
        '<h4 class="schedule-section-title"><i class="fas ' + warningIcon + '"></i> ' + (hasWarning ? "Warnings" : "Tips") + '</h4>' +
        '<ul class="schedule-list">' + warningItems + '</ul>' +
      '</div>';
    }

    container.innerHTML = '<div class="schedule-content">' + timeSlotsHtml + personalizationHtml + foodHtml + warningsHtml + '</div>';
  }

  // Helper function to get icon based on time (for AI schedule with explicit times)
  function getTimeIcon(timeStr) {
    try {
      var hour = parseInt(timeStr.split(":")[0], 10);
      if (hour < 10) {
        return '<i class="fas fa-sun" style="color: #f59e0b;"></i>'; // Early morning
      } else if (hour < 12) {
        return '<i class="fas fa-sun" style="color: #f59e0b;"></i>'; // Morning
      } else if (hour < 17) {
        return '<i class="fas fa-cloud-sun" style="color: #3b82f6;"></i>'; // Afternoon
      } else if (hour < 20) {
        return '<i class="fas fa-moon" style="color: #8b5cf6;"></i>'; // Evening
      } else {
        return '<i class="fas fa-star" style="color: #6366f1;"></i>'; // Night
      }
    } catch (e) {
      return '<i class="fas fa-clock" style="color: #6b7280;"></i>';
    }
  }

  function escapeHtml(text) {
    if (!text) return "";
    var div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /* ---------- INIT ---------- */
  function initDashboard() {
    renderBanner();
    renderRecovery();
    renderInjuryWarning();
    renderMedicationSchedule();
    renderGlance();
    renderBenjiNotes();
    renderGoals();
    initCheckinModal();
  }

  // Helper function to parse Firestore timestamps or date strings
  function parseFirestoreDate(dateField) {
    if (!dateField) return new Date();

    // If it's a Firestore timestamp object with toDate method
    if (dateField.toDate && typeof dateField.toDate === 'function') {
      return dateField.toDate();
    }

    // If it's a Firestore timestamp object with _seconds
    if (dateField._seconds) {
      return new Date(dateField._seconds * 1000);
    }

    // If it's an object with seconds property
    if (dateField.seconds) {
      return new Date(dateField.seconds * 1000);
    }

    // Try parsing as ISO string or timestamp
    var parsed = new Date(dateField);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function mapApiGoalsToRings(goals) {
    if (!goals || goals.length === 0) return null;
    var colors = ["#3a7d44", "#5a9a64", "#7ab884", "#9ad6a4", "#b8e6c4"];

    return goals.map(function (g, i) {
      // Extract numeric values from Measurable field (e.g., "5 oz" -> 5)
      var measurableStr = g.Measurable || "";
      var targetMatch = measurableStr.match(/(\d+(\.\d+)?)/);
      var targetValue = targetMatch ? parseFloat(targetMatch[1]) : 100;

      // Calculate progress based on check-ins
      var checkIns = (g.CheckIns && g.CheckIns.checkins) || [];
      var currentValue = checkIns.length || 0;

      // Calculate progress percentage
      var progressPct = 0;
      if (targetValue > 0) {
        progressPct = Math.min(100, Math.round((currentValue / targetValue) * 100));
      }

      // Calculate weeks using robust date parsing
      var now = new Date();
      var startDate = parseFirestoreDate(g.DateCreated);
      var endDate = parseFirestoreDate(g.EndDate);

      var totalWeeks = Math.ceil((endDate - startDate) / (7 * 24 * 60 * 60 * 1000));
      var currentWeek = Math.ceil((now - startDate) / (7 * 24 * 60 * 60 * 1000));

      // Ensure valid week numbers
      totalWeeks = totalWeeks > 0 ? totalWeeks : 12;
      currentWeek = Math.max(1, Math.min(currentWeek, totalWeeks));

      // Extract unit from Measurable (e.g., "5 oz" -> "oz", "5 times a week" -> "times/week")
      var unit = "times";
      if (measurableStr) {
        // Check for common patterns
        if (measurableStr.toLowerCase().includes("times")) {
          unit = "times";
        } else {
          var unitMatch = measurableStr.match(/\d+(\.\d+)?\s*([a-zA-Z]+)/);
          if (unitMatch && unitMatch[2]) {
            unit = unitMatch[2];
          }
        }
      }

      return {
        id: g.goal_id || "goal_" + i,
        label: g.Specific || "Goal " + (i + 1),
        specific: g.Description || g.Specific || "",
        measurable: g.Measurable || "",
        currentValue: currentValue,
        targetValue: targetValue,
        unit: unit,
        progressPct: progressPct,
        weekCurrent: currentWeek,
        weekTotal: totalWeeks,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        color: colors[i % colors.length],
        type: g.type || "wellness",
        // SMART goal fields for targetedgoal.html
        Specific: g.Specific || "",
        Measurable: g.Measurable || "",
        Attainable: g.Attainable || "",
        Relevant: g.Relevant || "",
        Time_Bound: g.Time_Bound || "",
        Description: g.Description || g.Specific || ""
      };
    });
  }

  // Schedule mode localStorage key (same as medications.js)
  var SCHEDULE_MODE_KEY = 'Benji_medication_schedule_mode';

  function getScheduleMode() {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(SCHEDULE_MODE_KEY) || 'standard';
    }
    return 'standard';
  }

  // When mode is 'ai', use cache only (no API call). When mode is 'standard', fetch from API.
  function fetchMedicationSchedule(userId) {
    var scheduleMode = getScheduleMode();
    var useAi = scheduleMode === 'ai';

    if (useAi && window.BenjiAPI && window.BenjiAPI.getCachedAiSchedule) {
      var cached = window.BenjiAPI.getCachedAiSchedule(userId);
      medicationScheduleData = cached || null;
      return Promise.resolve();
    }

    return window.BenjiAPI.getMedicationSchedule(userId, false)
      .then(function (data) {
        medicationScheduleData = data;
      })
      .catch(function () {
        medicationScheduleData = null;
      });
  }

  function runInit() {
    if (window.BenjiAPI && window.BenjiAPI.getSession) {
      var session = window.BenjiAPI.getSession();
      if (session && session.user_id) {
        console.log("Fetching goals for user:", session.user_id);
        // Fetch goals, medication schedule, and check-ins in parallel
        var goalsPromise = window.BenjiAPI.getGoals(session.user_id)
          .then(function (data) {
            console.log("Goals API response:", data);
            // Try to use the 'goals' array first (new format), then fall back to 'accepted' (legacy)
            var goalsArray = data.goals && data.goals.length > 0 ? data.goals : data.accepted;
            console.log("Using goals array:", goalsArray);
            var fromApi = mapApiGoalsToRings(goalsArray);
            console.log("Mapped goals to rings:", fromApi);
            if (fromApi && fromApi.length > 0) {
              fauxGoals = fromApi;
              console.log("Successfully loaded", fromApi.length, "goals from database");
            } else {
              console.log("No goals found, using default faux data");
            }
          })
          .catch(function (err) {
            console.error("Goals fetch failed:", err);
            // Goals fetch failed, use faux data
          });

        // Fetch medication schedule using persisted mode (standard or AI)
        var medsPromise = fetchMedicationSchedule(session.user_id);

        // Fetch check-ins and determine if today's check-in is done
        var checkinsPromise = window.BenjiAPI.getCheckins(session.user_id)
          .then(function (checkins) {
            console.log("Checkins API response:", checkins);
            if (checkins && checkins.length > 0) {
              // Check if any check-in is from today
              for (var i = 0; i < checkins.length; i++) {
                var c = checkins[i];
                // Check createdAt or timestamp field
                var dateField = c.createdAt || c.timestamp || c.date;
                if (isToday(dateField)) {
                  checkinDone = true;
                  todayCheckinData = c;
                  // Update goal ring progress based on today's goal responses if available
                  if (c.goals && Array.isArray(c.goals) && fauxGoals.length) {
                    fauxGoals = fauxGoals.map(function(g) {
                      var match = c.goals.find(function(gr) { return gr.goalId === g.id || gr.goalTitle === g.label; });
                      if (match && typeof match.progress === 'number') {
                        // treat progress 1-5 as percent of target for demo
                        var pctIncrement = (match.progress / 5) * 20; // arbitrary 20% max boost per day
                        g.progressPct = Math.min(100, Math.round(g.progressPct + pctIncrement));
                        g.currentValue = Math.min(g.targetValue, Math.round((g.progressPct / 100) * g.targetValue));
                      }
                      return g;
                    });
                  }
                  // Load Benji's Notes if persisted on the check-in document
                  if (c.benji_notes && Array.isArray(c.benji_notes)) {
                    benjiNotesData = c.benji_notes;
                    console.log("Found Benji's Notes:", benjiNotesData);
                  }
                  console.log("Found today's check-in:", c);
                  break;
                }
              }
            }
            if (!checkinDone) {
              console.log("No check-in found for today");
            }
          })
          .catch(function (err) {
            console.error("Checkins fetch failed:", err);
            // checkinDone stays false
          });

        Promise.all([goalsPromise, medsPromise, checkinsPromise])
          .then(function () {
            initDashboard();
          })
          .catch(function () {
            initDashboard();
          });
        return;
      }
    }
    initDashboard();
  }

  // Visibility change: when mode is 'ai', use cache only (no API). When 'standard', refetch from API.
  var dashboardInitialized = false;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !dashboardInitialized) return;
    if (!window.BenjiAPI || !window.BenjiAPI.getSession) return;
    var session = window.BenjiAPI.getSession();
    if (!session || !session.user_id) return;

    var scheduleMode = getScheduleMode();
    if (scheduleMode === 'ai' && window.BenjiAPI.getCachedAiSchedule) {
      medicationScheduleData = window.BenjiAPI.getCachedAiSchedule(session.user_id) || null;
      renderMedicationSchedule();
    } else {
      fetchMedicationSchedule(session.user_id).then(function () {
        renderMedicationSchedule();
      });
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      runInit();
      dashboardInitialized = true;
    });
  } else {
    runInit();
    dashboardInitialized = true;
  }
})();
