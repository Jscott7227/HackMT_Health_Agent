(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ── Main domain tabs ─────────────────────────────── */
  let domains = ["day", "goals"];
  let currentIndex = 0;

  const tabs = $$("#checkinTabs .nav-tab");
  const prevBtn = $("#prevDomain");
  const nextBtn = $("#nextDomain");
  const submitBtn = $("#submitCheckin");
  const progressText = $("#progressText");
  const progressFill = $("#progressFill");
  const loading = $("#loadingOverlay");

  /* ── Recommendations by Benji ─────────────────────── */
  const recommendationsSection = $("#benjiRecommendationsSection");
  const recommendationsResponse = $("#recommendationsResponse");
  const recommendationsLoading = $("#recommendationsLoading");
  const getRecommendationsBtn = $("#getRecommendationsBtn");
  const getCustomRecommendationsBtn = $("#getCustomRecommendationsBtn");
  const benjiContextInput = $("#benjiContextInput");

  const session = JSON.parse(
    sessionStorage.getItem("sanctuary_session") ||
    localStorage.getItem("sanctuary_session") ||
    "{}"
  );
  const userId = session.user_id || null;

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
    ['#eatScore', '#eatScoreValue'],
    ['#drinkScore', '#drinkScoreValue'],
    ['#sleepScore', '#sleepScoreValue'],
  ];


  const setReadout = (sliderSel, readoutSel) => {
    const slider = $(sliderSel);
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

  /* ── Goals dynamic questions ─────────────────────── */
  const goalContainer = $("#goalQuestionContainer");

  const renderGoalQuestions = (goals) => {
    if (!goalContainer) return;
    if (!goals || !goals.length) {
      goalContainer.innerHTML = `
        <div class="form-note" style="text-align:center;">
          No goals yet. Visit the <a href="goals.html">Goals page</a> to set them up.
        </div>`;
      return;
    }
    const html = goals.map((g, idx) => {
      const label = g.Description || g.Specific || g.Specifics || `Goal ${idx + 1}`;
      const goalId = g.id || g.ID || g._id || `goal_${idx}`;
      return `
        <div class="card goal-question" data-goal-id="${goalId}">
          <div class="domain-header">
            <h3 class="domain-title" style="margin:0 0 6px 0;">${label}</h3>
            ${g.Time_Bound ? `<p class="checkin-hint">${g.Time_Bound}</p>` : ""}
          </div>
          <div class="form-group">
            <label class="form-label">Progress update</label>
            <input type="text" class="text-input goal-progress" data-goal-id="${goalId}" placeholder="e.g. 7 hrs sleep, hit protein, completed session">
          </div>
          <div class="form-group">
            <label class="form-label">Notes (optional)</label>
            <textarea class="text-area goal-note" data-goal-id="${goalId}" rows="2" placeholder="Anything notable for this goal today?"></textarea>
          </div>
        </div>
      `;
    }).join("");
    goalContainer.innerHTML = html;
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

  /* ── Load goals for goal tab ─────────────────────── */
  const loadGoals = async () => {
    if (!goalContainer) return;
    const session = window.BenjiAPI?.getSession?.();
    if (!session || !session.user_id) {
      goalContainer.innerHTML = `<p class="form-note">Sign in to update goals.</p>`;
      return;
    }
    try {
      const data = await window.BenjiAPI.getGoals(session.user_id);
      const accepted = data && data.accepted != null ? data.accepted : data;
      const goals = Array.isArray(accepted) ? accepted : (accepted?.goals || []);
      renderGoalQuestions(goals || []);
    } catch (err) {
      console.error("Failed to load goals", err);
      goalContainer.innerHTML = `<p class="form-note">Could not load goals right now.</p>`;
    }
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

    const label = domains[currentIndex] === "day" ? "Daily Check-in" : "Goals";

    if (progressText) progressText.textContent = label;
    if (progressFill) progressFill.style.width =
      `${((currentIndex + 1) / domains.length) * 100}%`;

    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    const isLast = currentIndex === domains.length - 1;
    if (nextBtn) nextBtn.style.display = isLast ? "none" : "inline-flex";
    if (submitBtn) submitBtn.style.display = isLast ? "inline-flex" : "none";
  };

  /* ── Recovery Day toggle ──────────────────────────── */
  const fitnessGoalSection = $("#fitnessGoalSection");
  const recoveryHint = $("#recoveryHint");

  const updateRecoveryDay = () => {
    const isRecovery = getExclusiveValue("recoveryDay") === "yes";
    if (fitnessGoalSection) fitnessGoalSection.style.display = isRecovery ? "none" : "";
    if (recoveryHint) recoveryHint.style.display = isRecovery ? "block" : "none";
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
      /* Daily */
      dayNotes: str("#dayNotes"),
      tags: getTags(),
      eatScore: num("#eatScore"),
      drinkScore: num("#drinkScore"),
      sleepScore: num("#sleepScore"),
      goalResponses: getGoalResponses(),
      timestamp: new Date().toISOString(),
      benjiContext: str("#benjiContextInput"),
    };
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

  /* ── Fetch relevant questions for the user ────────── */
  /* ── Fetch relevant questions for the user ────────── */
  const fetchRelevantQuestions = async () => {
    try {
      const session = window.BenjiAPI?.getSession?.();
      if (!session || !session.user_id) return [];

      const resp = await fetch("http://localhost:8000/relevant-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session.user_id,
          active_goals: JSON.parse(localStorage.getItem("Benji_fitnessGoals") || "[]")
        })
      });

      if (!resp.ok) throw new Error("Failed to fetch questions");

      const data = await resp.json();

      // Expecting either an array or an object whose values are arrays
      if (Array.isArray(data.questions)) return data.questions;

      if (data.questions && typeof data.questions === "object") {
        return Object.values(data.questions).flat();
      }

      return [];
    } catch (err) {
      console.error("Error fetching relevant questions:", err);
      return [];
    }
  };

  /* ── Hide questions that are not relevant ─────────── */
  const filterPageByQuestions = (questions) => {
    if (!questions) return;

    console.log("Filtering page using relevant questions:", questions);

    const questionMap = {
      "Any notes about your day?": "#dayNotes",
      "What tags describe your day?": "#tagsSection",
      "Rate your eating, drinking, and sleep today.": "#eatScore, #drinkScore, #sleepScore",
      "Rate your overall fitness today.": "#fitnessScore",
      "Any notes on your fitness?": "#fitnessNotes",
      "Rate your fitness goal performance.": "#fitnessGoalScore",
      "Rate your wellness today.": "#wellnessScore",
      "Any notes on wellness?": "#wellnessNotes",
      "Rate your stress level.": "#stressScore",
      "How is your mood today?": "#moodSection",
      "When did your last period start?": "#lastPeriodStart",
      "What is your current flow?": "[name='flow']",
      "Which symptoms are present?": "[name='symptoms']",
      "Rate your cramp pain.": "#crampPain",
      "Do you have any unusual discharge?": "#dischargeNotesWrap",
      "Are you taking oral contraceptives?": "#ocpDetails",
      "Which type of OCP?": "#ocpType"
    };

    let flat = [];
    if (Array.isArray(questions)) flat = questions;
    else flat = Object.values(questions).flat();

    Object.values(questionMap).forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const wrapper = el.closest(".form-group");
        if (wrapper) wrapper.classList.add("force-hidden");
      });
    });

    // questionsArray.forEach(q => {
    //   const sel = questionMap[q];
    //   if (!sel) return;

    //   document.querySelectorAll(sel).forEach(el => {
    //     const wrapper = el.closest(".form-group");
    //     if (wrapper) wrapper.classList.remove("force-hidden");
    //   });
    // });
  };

  filterPageByQuestions("")


  /* ── Run on page load ─────────────────────────────── */


  // At the end of your ini


  /* ── Init ─────────────────────────────────────────── */
  initReadouts();
  loadGoals();
  setDomain(0);

  (async () => {
    const questions = await fetchRelevantQuestions();
    filterPageByQuestions(questions);
    setDomain(0);
  })();

})();
