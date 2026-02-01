(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ── Main domain tabs ─────────────────────────────── */
  let domains = ["day", "fitness", "wellness"]; // menstrual added if enabled
  let currentIndex = 0;

  const tabs       = $$("#checkinTabs .nav-tab");
  const prevBtn    = $("#prevDomain");
  const nextBtn    = $("#nextDomain");
  const submitBtn  = $("#submitCheckin");
  const progressText = $("#progressText");
  const progressFill = $("#progressFill");
  const loading    = $("#loadingOverlay");
  const menstrualTab = $('#checkinTabs .nav-tab[data-domain="menstrual"]');
  const menstrualSection = $("#domain-menstrual");

  /* ── Recommendations by Benji ─────────────────────── */
  const recommendationsSection = $("#benjiRecommendationsSection");
  const recommendationsResponse = $("#recommendationsResponse");
  const recommendationsLoading = $("#recommendationsLoading");
  const getRecommendationsBtn = $("#getRecommendationsBtn");
  const getCustomRecommendationsBtn = $("#getCustomRecommendationsBtn");
  const benjiContextInput = $("#benjiContextInput");

  const showRecommendationsLoading = (show) => {
    if (recommendationsLoading) {
      recommendationsLoading.style.display = show ? "block" : "none";
    }
    if (recommendationsResponse) {
      recommendationsResponse.style.display = show ? "none" : "block";
    }
  };

  const displayRecommendations = (responseText) => {
    if (!recommendationsResponse) return;
    
    // Convert markdown-style formatting to HTML
    let html = responseText
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')  // Bold
      .replace(/\n/g, '<br>');  // Line breaks
    
    recommendationsResponse.innerHTML = `<div class="recommendations-content">${html}</div>`;
  };

  const displayRecommendationsError = (errorMsg) => {
    if (!recommendationsResponse) return;
    recommendationsResponse.innerHTML = `<div class="recommendations-error">
      <i class="fa-solid fa-circle-exclamation"></i> ${errorMsg}
    </div>`;
  };

  const fetchRecommendations = async (userMessage = null) => {
    // Get user session
    const session = window.BenjiAPI?.getSession?.();
    if (!session || !session.user_id) {
      displayRecommendationsError("Please sign in to get personalized recommendations.");
      return;
    }

    showRecommendationsLoading(true);

    try {
      const body = { user_id: session.user_id };
      if (userMessage && userMessage.trim()) {
        body.user_message = userMessage.trim();
      }

      const result = await window.BenjiAPI.postCheckinRecommendations(body);
      
      if (result && result.response) {
        displayRecommendations(result.response);
      } else {
        displayRecommendationsError("No recommendations received. Please try again.");
      }
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      displayRecommendationsError("Unable to get recommendations. Please check your connection and try again.");
    } finally {
      showRecommendationsLoading(false);
    }
  };

  // Wire up recommendation buttons
  getRecommendationsBtn?.addEventListener("click", () => {
    fetchRecommendations();
  });

  getCustomRecommendationsBtn?.addEventListener("click", () => {
    const userMessage = benjiContextInput?.value || "";
    fetchRecommendations(userMessage);
  });

  /* ── All slider ↔ readout pairs ───────────────────── */
  const sliderReadouts = [
    ["#dayScore",           "#dayScoreValue"],
    ["#eatScore",           "#eatScoreValue"],
    ["#drinkScore",         "#drinkScoreValue"],
    ["#sleepScore",         "#sleepScoreValue"],
    ["#fitnessScore",       "#fitnessScoreValue"],
    ["#fitnessGoalScore",   "#fitnessGoalScoreValue"],
    ["#wellnessScore",      "#wellnessScoreValue"],
    ["#stressScore",        "#stressScoreValue"],
    ["#cardioIntensity",    "#cardioIntensityValue"],
    ["#mobTightness",       "#mobTightnessValue"],
    ["#mobStiffness",       "#mobStiffnessValue"],
    ["#mobSoreness",        "#mobSorenessValue"],
    ["#mobLooseness",       "#mobLoosenessValue"],
    ["#mobPainLevel",       "#mobPainLevelValue"],
    ["#injPainIntensity",   "#injPainIntensityValue"],
    ["#injStiffness",       "#injStiffnessValue"],
    ["#injFunctionScore",   "#injFunctionScoreValue"],
    ["#rehabAfterEffects",  "#rehabAfterEffectsValue"],
    ["#perfIntensity",      "#perfIntensityValue"],
    ["#perfDifficulty",     "#perfDifficultyValue"],
    ["#perfSoreness",       "#perfSorenessValue"],
    ["#perfFatigue",        "#perfFatigueValue"],
    ["#crampPain",          "#crampPainValue"],

  ];

  const setReadout = (sliderSel, readoutSel) => {
    const slider  = $(sliderSel);
    const readout = $(readoutSel);
    if (!slider || !readout) return;
    readout.textContent = slider.value;
  };

  const initReadouts = () => {
    sliderReadouts.forEach(([s, r]) => {
      setReadout(s, r);
      const slider = $(s);
      if (slider) slider.addEventListener("input", () => setReadout(s, r));
    });
  };

  /* ── Button groups (single-select) ────────────────── */
  const setExclusiveActive = (group, value) => {
    $$(`button[data-group="${group}"]`).forEach(b =>
      b.classList.toggle("active", b.dataset.value === value)
    );
  };

  const getExclusiveValue = (group) => {
    const active = $(`button[data-group="${group}"].active`);
    return active ? active.dataset.value : null;
  };

  /* ── Domain switching ─────────────────────────────── */
  const setDomain = (index) => {
    if (!domains.length) return;
    currentIndex = Math.max(0, Math.min(domains.length - 1, index));

    domains.forEach((d, i) => {
      const sec = $(`#domain-${d}`);
      if (sec) sec.classList.toggle("active", i === currentIndex);
    });

    tabs.forEach(t =>
      t.classList.toggle("active", t.dataset.domain === domains[currentIndex])
    );

    const label = domains[currentIndex] === "day" ? "Overall Day"
                : domains[currentIndex] === "fitness" ? "Fitness"
                : domains[currentIndex] === "wellness" ? "Wellness"
                : "Menstrual";

    if (progressText) progressText.textContent = label;
    if (progressFill) progressFill.style.width =
      `${((currentIndex + 1) / domains.length) * 100}%`;

    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    const isLast = currentIndex === domains.length - 1;
    if (nextBtn)   nextBtn.style.display   = isLast ? "none" : "inline-flex";
    if (submitBtn) submitBtn.style.display = isLast ? "inline-flex" : "none";
  };

  /* ── Recovery Day toggle ──────────────────────────── */
  const fitnessGoalSection = $("#fitnessGoalSection");
  const recoveryHint       = $("#recoveryHint");

  const updateRecoveryDay = () => {
    const isRecovery = getExclusiveValue("recoveryDay") === "yes";
    if (fitnessGoalSection) fitnessGoalSection.style.display = isRecovery ? "none" : "";
    if (recoveryHint)       recoveryHint.style.display       = isRecovery ? "block" : "none";
  };

  /* ── Menstrual visibility (cycle tracking) ────────── */
  const setMenstrualVisibility = (enabled) => {
    const has = domains.includes("menstrual");
    if (enabled && !has) {
      domains.push("menstrual");
      if (menstrualTab) menstrualTab.style.display = "inline-flex";
      if (menstrualSection) menstrualSection.style.display = "";
      setDomain(currentIndex);
    } else if (!enabled && has) {
      domains = domains.filter(d => d !== "menstrual");
      if (menstrualTab) menstrualTab.style.display = "none";
      if (menstrualSection) menstrualSection.style.display = "none";
      if (currentIndex >= domains.length) setDomain(domains.length - 1);
      setDomain(currentIndex); // refresh progress widths
    }
  };

  const detectCycleTracking = async () => {
    let enabled = false;
    let foundInBackend = false;
    const session = window.BenjiAPI?.getSession?.();

    if (session && session.user_id) {
      console.log("Detecting cycle tracking for user:", session.user_id);

      // 1) Check backend profileinfo first (source of truth)
      if (window.BenjiAPI?.getProfileInfo) {
        try {
          const profile = await window.BenjiAPI.getProfileInfo(session.user_id);
          console.log("Profile data for cycle tracking:", profile);

          if (profile.benji_facts) {
            try {
              const facts = typeof profile.benji_facts === "string"
                ? JSON.parse(profile.benji_facts) : profile.benji_facts;

              // Check summary for cycle tracking setting (comma-delimited format)
              if (facts?.summary) {
                const summaryLower = facts.summary.toLowerCase();
                console.log("=== CYCLE TRACKING DEBUG ===");
                console.log("Raw summary string:", facts.summary);
                console.log("Lowercase summary:", summaryLower);

                // Only enable if explicitly set to "yes"
                if (summaryLower.includes("cycle tracking: yes")) {
                  enabled = true;
                  foundInBackend = true;
                  console.log("✓ Menstrual tracking ENABLED (found 'Cycle tracking: Yes')");
                } else if (summaryLower.includes("cycle tracking: no")) {
                  // Explicitly "No"
                  enabled = false;
                  foundInBackend = true;
                  console.log("✗ Menstrual tracking DISABLED (found 'Cycle tracking: No')");
                } else if (summaryLower.includes("cycle tracking: not applicable")) {
                  // Explicitly "Not applicable"
                  enabled = false;
                  foundInBackend = true;
                  console.log("✗ Menstrual tracking DISABLED (found 'Cycle tracking: Not applicable')");
                } else if (summaryLower.includes("cycle tracking:")) {
                  // Found cycle tracking but didn't match any specific case
                  enabled = false;
                  foundInBackend = true;
                  console.log("✗ Menstrual tracking DISABLED (found 'Cycle tracking:' but value unknown)");
                  console.warn("Unexpected cycle tracking value in summary:", facts.summary);
                }
                console.log("=== END DEBUG ===");
              }
            } catch (e) {
              console.warn("Failed to parse benji_facts:", e);
            }
          }
        } catch (e) {
          console.warn("Profile info load failed; using default menstrual visibility", e);
        }
      }

      // 2) Only use localStorage if backend didn't have any cycle tracking data
      if (!foundInBackend) {
        console.log("No cycle tracking data in backend, checking localStorage");
        try {
          const cached = localStorage.getItem(`userProfile_${session.user_id}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            // Only enable if explicitly "yes"
            if (parsed.cycleTracking === "yes") {
              enabled = true;
              console.log("Menstrual tracking enabled from localStorage");
            } else {
              console.log("Menstrual tracking not enabled in localStorage");
            }
          }
        } catch { /* ignore */ }
      } else {
        // Backend had data, ignore localStorage to prevent conflicts
        console.log("Backend has cycle tracking data, ignoring localStorage");
      }
    }

    console.log("Final menstrual tracking state:", enabled);
    setMenstrualVisibility(enabled);
  };

  /* ── Fitness goal tabs — predefined from profile ──── */
  // All possible goal keys (must match data-goal attrs in HTML)
  const ALL_GOALS = [
    "weight-loss", "weight-gain", "body-recomp", "strength",
    "cardio", "general", "mobility", "injury", "rehab", "performance",
  ];

  /**
   * Read the user's configured fitness goals from localStorage.
   * Expected format: an array of goal-key strings, e.g.
   *   ["weight-loss","cardio","mobility"]
   * If nothing is stored yet, show ALL tabs so the user can still check in.
   */
  const getUserGoals = () => {
    try {
      const raw = localStorage.getItem("Benji_fitnessGoals");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore parse errors */ }
    return ALL_GOALS; // fallback: show everything
  };

  const userGoals = getUserGoals();

  const initGoalTabs = () => {
    // Hide tabs + panels that aren't in the user's goal list
    $$(".goal-tab").forEach(btn => {
      const goal = btn.dataset.goal;
      if (!userGoals.includes(goal)) {
        btn.style.display = "none";
      }
    });
    $$(".goal-panel").forEach(panel => {
      const goal = panel.id.replace("goal-", "");
      // Only show panels that are in the user's goals
      panel.style.display = userGoals.includes(goal) ? "block" : "none";
    });
  };

  /* ── Menstrual toggles ────────────────────────────── */
  const dischargeNotesWrap = $("#dischargeNotesWrap");
  const ocpDetails = $("#ocpDetails");

  const updateDischargeNotes = () => {
    const v = getExclusiveValue("discharge");
    if (!dischargeNotesWrap) return;
    dischargeNotesWrap.style.display =
      (v === "unusual" || v === "gray" || v === "clumpy-white") ? "block" : "none";
  };

  const updateOCPDetails = () => {
    const yes = getExclusiveValue("ocp") === "yes";
    if (!ocpDetails) return;
    ocpDetails.style.display = yes ? "block" : "none";
  };


  /* ── Flare-up toggle ──────────────────────────────── */
  const flareupDetails = $("#flareupDetails");

  const updateFlareup = () => {
    const has = getExclusiveValue("rehab-flareup") === "yes";
    if (flareupDetails) flareupDetails.style.display = has ? "block" : "none";
  };

  /* ── Build payload ────────────────────────────────── */
  const getTags = () =>
    $$('input[name="tags"]:checked').map(i => i.value);

  const getFlareupTriggers = () =>
    $$('input[name="flareup-trigger"]:checked').map(i => i.value);

  const num = (id) => Number($(id)?.value) || 0;
  const str = (id) => ($(id)?.value ?? "").trim();
  const daysSince = (dateStr) => {
    if (!dateStr) return 0;
    const start = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(start.getTime())) return 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = today - start;
    const diffDays = Math.floor(diffMs / 86400000) + 1;
    return diffDays > 0 ? diffDays : 0;
  };

  const payload = () => {
    const data = {
      /* Overall Day */
      dayScore:   num("#dayScore"),
      dayNotes:   str("#dayNotes"),
      tags:       getTags(),
      eatScore:   num("#eatScore"),
      drinkScore: num("#drinkScore"),
      sleepScore: num("#sleepScore"),

      /* Fitness core */
      fitnessScore:     num("#fitnessScore"),
      fitnessNotes:     str("#fitnessNotes"),
      fitnessGoalScore: num("#fitnessGoalScore"),
      recoveryDay:      getExclusiveValue("recoveryDay") === "yes",

      /* Wellness */
      wellnessScore: num("#wellnessScore"),
      wellnessNotes: str("#wellnessNotes"),
      stress:        num("#stressScore"),
      mood:          Number(getExclusiveValue("mood") ?? 0),

      /* Menstrual */
      menstrual: {
        lastPeriodStart: str("#lastPeriodStart"),
        cycleDay: daysSince(str("#lastPeriodStart")),
        flow: getExclusiveValue("flow"), // light | medium | heavy | blood-clots
        symptoms: $$('input[name="symptoms"]:checked').map(i => i.value),
        crampPain: num("#crampPain"), // 0–10
        discharge: getExclusiveValue("discharge"), // none | creamy | watery | sticky | egg-white | spotting | unusual | clumpy-white | gray
        dischargeNotes: str("#dischargeNotes"),
        oralContraceptives: getExclusiveValue("ocp") === "yes",
        ocpType: str("#ocpType"),
      },


      /* Meta */
      activeGoals: userGoals,
      timestamp:   new Date().toISOString(),
      
      /* Benji Context - what user wanted Benji to know */
      benjiContext: str("#benjiContextInput"),
    };

    // Skip goal detail sections on recovery days
    if (!data.recoveryDay) {
      if (userGoals.includes("weight-loss")) {
        data.weightLoss = {
          calories:     num("#wl-calories"),
          trainingType: getExclusiveValue("wl-training"),
          weight:       num("#wl-weight"),
        };
      }
      if (userGoals.includes("weight-gain")) {
        data.weightGain = {
          calories: num("#wg-calories"),
          weight:   num("#wg-weight"),
        };
      }
      if (userGoals.includes("body-recomp")) {
        data.bodyRecomp = {
          calories:  num("#br-calories"),
          protein:   num("#br-protein"),
          hydration: num("#br-hydration"),
          carbs:     num("#br-carbs"),
          fats:      num("#br-fats"),
          fiber:     num("#br-fiber"),
          weight:    num("#br-weight"),
        };
      }
      if (userGoals.includes("strength")) {
        data.strength = {
          calories:  num("#st-calories"),
          protein:   num("#st-protein"),
          carbs:     num("#st-carbs"),
          fat:       num("#st-fat"),
          hydration: num("#st-hydration"),
          weight:    num("#st-weight"),
        };
      }
      if (userGoals.includes("cardio")) {
        data.cardio = {
          activityType: getExclusiveValue("cardio-type"),
          volume:       num("#cardio-volume"),
          distance:     num("#cardio-distance"),
          pace:         str("#cardio-pace"),
          intensity:    num("#cardioIntensity"),
        };
      }
      if (userGoals.includes("general")) {
        data.general = {
          activity: str("#general-activity"),
          method:   getExclusiveValue("general-method"),
          weight:   num("#general-weight"),
        };
      }
      if (userGoals.includes("mobility")) {
        data.mobility = {
          sessions:     num("#mob-sessions"),
          tightness:    num("#mobTightness"),
          stiffness:    num("#mobStiffness"),
          soreness:     num("#mobSoreness"),
          looseness:    num("#mobLooseness"),
          painLevel:    num("#mobPainLevel"),
          painLocation: str("#mob-pain-location"),
          romNotes:     str("#mob-rom-notes"),
        };
      }
      if (userGoals.includes("injury")) {
        data.injury = {
          painIntensity:     num("#injPainIntensity"),
          painLocation:      str("#inj-pain-location"),
          painType:          getExclusiveValue("inj-pain-type"),
          painFrequency:     getExclusiveValue("inj-pain-freq"),
          stiffness:         num("#injStiffness"),
          functionScore:     num("#injFunctionScore"),
          activityTolerance: num("#inj-tolerance"),
        };
      }
      if (userGoals.includes("rehab")) {
        data.rehab = {
          trainingMinutes:    num("#rehab-minutes"),
          sessions:           num("#rehab-sessions"),
          afterEffects:       num("#rehabAfterEffects"),
          flareup:            getExclusiveValue("rehab-flareup") === "yes",
          flareupTriggers:    getFlareupTriggers(),
          flareupDescription: str("#flareupDesc"),
        };
      }
      if (userGoals.includes("performance")) {
        data.performance = {
          minutesTrained: num("#perf-minutes"),
          intensity:      num("#perfIntensity"),
          difficulty:     num("#perfDifficulty"),
          soreness:       num("#perfSoreness"),
          fatigue:        num("#perfFatigue"),
        };
      }
    }

    return data;
  };

  /* ── Event delegation ─────────────────────────────── */
  document.addEventListener("click", (e) => {
    // Main domain tab
    const tab = e.target.closest(".nav-tab");
    if (tab && tab.dataset.domain) {
      const idx = domains.indexOf(tab.dataset.domain);
      if (idx !== -1) setDomain(idx);
      return;
    }

    // Option-btn + emoji-btn groups
    const groupBtn = e.target.closest("button.option-btn, button.emoji-btn");
    if (groupBtn && groupBtn.dataset.group && groupBtn.dataset.value) {
      setExclusiveActive(groupBtn.dataset.group, groupBtn.dataset.value);
      if (groupBtn.dataset.group === "recoveryDay") updateRecoveryDay();
      if (groupBtn.dataset.group === "rehab-flareup") updateFlareup();
      if (groupBtn.dataset.group === "discharge") updateDischargeNotes();
      if (groupBtn.dataset.group === "ocp") updateOCPDetails();
      return;
    }
  });

  prevBtn?.addEventListener("click", () => setDomain(currentIndex - 1));
  nextBtn?.addEventListener("click", () => setDomain(currentIndex + 1));

  /* ── Submit ───────────────────────────────────────── */
  submitBtn?.addEventListener("click", async () => {
    const data = payload();

    if (data.dayScore < 1 || data.dayScore > 10) {
      alert("Day score must be between 1 and 10.");
      setDomain(0);
      return;
    }

    try {
      if (loading) loading.style.display = "flex";

      if (window.StorageAPI?.saveCheckin) {
        await window.StorageAPI.saveCheckin(data);
      } else {
        const key = "Benji_checkins";
        const arr = JSON.parse(localStorage.getItem(key) || "[]");
        arr.push(data);
        localStorage.setItem(key, JSON.stringify(arr));
      }

      let checkinId = null;
      let benjiNotes = null;
      
      if (window.BenjiAPI && window.BenjiAPI.getSession && window.BenjiAPI.postCheckin) {
        const session = window.BenjiAPI.getSession();
        if (session && session.user_id) {
          const body = Object.assign({ user_id: session.user_id, date: new Date().toISOString().slice(0, 10) }, data);
          
          // Save check-in and get the check-in ID
          try {
            const checkinResult = await window.BenjiAPI.postCheckin(body);
            checkinId = checkinResult?.id || null;
          } catch (err) {
            console.warn("Backend check-in save failed:", err);
          }
          
          // Call checkin-sense to get Benji's Notes (post check-in insights)
          if (window.BenjiAPI.postCheckinSense) {
            try {
              const senseResult = await window.BenjiAPI.postCheckinSense({
                user_id: session.user_id,
                checkin_data: data,
                checkin_id: checkinId
              });
              benjiNotes = senseResult?.notes || null;
              console.log("Benji's Notes:", benjiNotes);
            } catch (err) {
              console.warn("Failed to get Benji's Notes:", err);
            }
          }
        }
      }

      // Close the modal and update banner/glance if we're inside one (home page)
      // Pass both the check-in data and Benji's Notes to onComplete
      if (window.BenjiCheckinModal) {
        if (window.BenjiCheckinModal.onComplete) {
          window.BenjiCheckinModal.onComplete(data, benjiNotes);
        } else {
          window.BenjiCheckinModal.close();
        }
      }

      const agentMsg = $("#agentMessage");
      if (agentMsg) {
        agentMsg.innerHTML = `<p>Saved! Want to review your data?</p>`;
      }
    } catch (err) {
      console.error(err);
      alert("Couldn't save check-in. Check console for details.");
    } finally {
      if (loading) loading.style.display = "none";
    }
  });

  /* ── Init ─────────────────────────────────────────── */
  initReadouts();
  initGoalTabs();
  setMenstrualVisibility(false); // hide until we confirm preference
  setDomain(0);
  updateRecoveryDay();
  updateFlareup();
  updateDischargeNotes();
  updateOCPDetails();
  detectCycleTracking();

})();
