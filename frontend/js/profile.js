(function () {
  const API_BASE = "http://127.0.0.1:8000";
  const $ = (s) => document.querySelector(s);

  function getSession() {
    const s1 = localStorage.getItem("sanctuary_session");
    if (s1) return JSON.parse(s1);
    const s2 = sessionStorage.getItem("sanctuary_session");
    if (s2) return JSON.parse(s2);
    return null;
  }

  const session = getSession();
  if (!session || !session.user_id) {
    const loading = $("#profileLoading");
    if (loading) loading.textContent = "Please log in to view your profile.";
    return;
  }

  const userId = session.user_id;
  let originalProfile = { height: "", weight: "", benji_facts: "" };
  let originalSetup = {};

  // Clear old non-user-specific localStorage to prevent conflicts
  if (localStorage.getItem("userProfile")) {
    console.log("Clearing old non-user-specific localStorage data");
    localStorage.removeItem("userProfile");
  }

  const CONSTRAINT_OPTIONS = [
    { value: "limited-time", label: "Limited time" },
    { value: "high-stress", label: "High stress" },
    { value: "limited-gym", label: "Limited gym accessibility" },
    { value: "irregular-schedule", label: "Irregular schedule" },
    { value: "none-constraints", label: "None of the above" }
  ];

  const HEALTH_OPTIONS = [
    { value: "joint-pain", label: "Joint pain or injuries" },
    { value: "cardio-concerns", label: "Cardiovascular concerns" },
    { value: "metabolic", label: "Metabolic conditions" },
    { value: "prefer-not-health", label: "Prefer not to say" },
    { value: "none-health", label: "None" }
  ];

  const ACTIVITY_LABELS = ["Very inactive", "Lightly active", "Moderately active", "Very active"];
  const GOAL_LABELS = {
    "lose-fat": "Lose body fat",
    "build-muscle": "Build muscle",
    "endurance": "Improve endurance",
    "feel-healthier": "Feel healthier overall",
    "not-sure": "Not sure yet"
  };
  const EXPERIENCE_LABELS = {
    "beginner": "Beginner",
    "intermediate": "Intermediate",
    "advanced": "Advanced"
  };
  const CONFIDENCE_LABELS = {
    "not-confident": "Not confident",
    "somewhat": "Somewhat confident",
    "very": "Very confident"
  };
  const GENDER_LABELS = {
    "male": "Male",
    "female": "Female",
    "other": "Other",
    "prefer-not-to-say": "Prefer not to say"
  };
  const CYCLE_LABELS = {
    "yes": "Yes",
    "no": "No",
    "not-applicable": "Not applicable"
  };
  const SCALE_LABELS = {
    1: "Very low",
    2: "Low",
    3: "Moderate",
    4: "Good",
    5: "Very high"
  };
  const SLEEP_LABELS = {
    1: "Terrible",
    2: "Poor",
    3: "Okay",
    4: "Good",
    5: "Great"
  };

  function mapLabelsToValues(selectedLabels, options) {
    if (!Array.isArray(selectedLabels)) return [];
    return options
      .filter(opt => selectedLabels.includes(opt.label) || selectedLabels.includes(opt.value))
      .map(opt => opt.value);
  }

  function mapValuesToLabels(selectedValues, options) {
    if (!Array.isArray(selectedValues)) return [];
    return options
      .filter(opt => selectedValues.includes(opt.value) || selectedValues.includes(opt.label))
      .map(opt => opt.label);
  }

  function setSelect(id, value) {
    const el = $(`#${id}`);
    if (el) el.value = value || "";
  }

  function setInput(id, value) {
    const el = $(`#${id}`);
    if (el) el.value = value || "";
  }

  function setCheckboxGroup(containerId, selectedValues) {
    const container = $(`#${containerId}`);
    if (!container) return;
    const checks = container.querySelectorAll('input[type="checkbox"]');
    const valueSet = new Set(selectedValues || []);
    checks.forEach(chk => {
      chk.checked = valueSet.has(chk.value);
    });
  }

  function getCheckboxValues(containerId) {
    const container = $(`#${containerId}`);
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(chk => chk.value);
  }

  function applyNoneRule(containerId, noneValues) {
    const container = $(`#${containerId}`);
    if (!container) return;
    const checks = Array.from(container.querySelectorAll('input[type="checkbox"]'));
    const noneSelected = checks.some(chk => chk.checked && noneValues.includes(chk.value));
    if (noneSelected) {
      checks.forEach(chk => {
        if (!noneValues.includes(chk.value)) chk.checked = false;
      });
    }
  }

  function bindNoneRule(containerId, noneValues) {
    const container = $(`#${containerId}`);
    if (!container) return;
    container.addEventListener("change", (event) => {
      const target = event.target;
      if (target && target.type === "checkbox") {
        if (noneValues.includes(target.value) && target.checked) {
          applyNoneRule(containerId, noneValues);
        } else if (target.checked) {
          const noneChecks = container.querySelectorAll('input[type="checkbox"]');
          noneChecks.forEach(chk => {
            if (noneValues.includes(chk.value)) chk.checked = false;
          });
        }
      }
    });
  }

  function toggleMedList() {
    const medTracking = $("#medTracking")?.value || "";
    const wrap = $("#medListWrap");
    if (!wrap) return;
    wrap.style.display = medTracking === "yes" ? "block" : "none";
    if (medTracking !== "yes") {
      const input = $("#medList");
      if (input) input.value = "";
    }
  }

  function setUnitButtons(toggleId, unit) {
    const toggle = $(`#${toggleId}`);
    if (!toggle) return;
    toggle.querySelectorAll(".unit-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.unit === unit);
    });
  }

  function setHeightFromValue(val) {
    if (!val) {
      setUnitButtons("heightUnitToggle", "imperial");
      $("#heightImperial").style.display = "flex";
      $("#heightMetric").style.display = "none";
      $("#heightFt").value = "";
      $("#heightIn").value = "";
      $("#heightCm").value = "";
      return;
    }
    const cmMatch = val.match(/(\d+)\s*cm/i);
    const ftMatch = val.match(/(\d+)\s*ft\s*(\d+)\s*in/i);
    if (cmMatch) {
      setUnitButtons("heightUnitToggle", "metric");
      $("#heightImperial").style.display = "none";
      $("#heightMetric").style.display = "flex";
      $("#heightCm").value = cmMatch[1];
      $("#heightFt").value = "";
      $("#heightIn").value = "";
    } else if (ftMatch) {
      setUnitButtons("heightUnitToggle", "imperial");
      $("#heightImperial").style.display = "flex";
      $("#heightMetric").style.display = "none";
      $("#heightFt").value = ftMatch[1];
      $("#heightIn").value = ftMatch[2];
      $("#heightCm").value = "";
    } else {
      setUnitButtons("heightUnitToggle", "imperial");
      $("#heightImperial").style.display = "flex";
      $("#heightMetric").style.display = "none";
      $("#heightFt").value = "";
      $("#heightIn").value = "";
      $("#heightCm").value = "";
    }
  }

  function setWeightFromValue(val) {
    if (!val) {
      setUnitButtons("weightUnitToggle", "imperial");
      $("#weightImperial").style.display = "flex";
      $("#weightMetric").style.display = "none";
      $("#weightLb").value = "";
      $("#weightKg").value = "";
      return;
    }
    const kgMatch = val.match(/(\d+)\s*kg/i);
    const lbMatch = val.match(/(\d+)\s*lb/i);
    if (kgMatch) {
      setUnitButtons("weightUnitToggle", "metric");
      $("#weightImperial").style.display = "none";
      $("#weightMetric").style.display = "flex";
      $("#weightKg").value = kgMatch[1];
      $("#weightLb").value = "";
    } else if (lbMatch) {
      setUnitButtons("weightUnitToggle", "imperial");
      $("#weightImperial").style.display = "flex";
      $("#weightMetric").style.display = "none";
      $("#weightLb").value = lbMatch[1];
      $("#weightKg").value = "";
    } else {
      setUnitButtons("weightUnitToggle", "imperial");
      $("#weightImperial").style.display = "flex";
      $("#weightMetric").style.display = "none";
      $("#weightLb").value = "";
      $("#weightKg").value = "";
    }
  }

  function bindUnitToggles() {
    const heightToggle = $("#heightUnitToggle");
    const weightToggle = $("#weightUnitToggle");
    if (heightToggle) {
      heightToggle.addEventListener("click", (e) => {
        const btn = e.target.closest(".unit-btn");
        if (!btn) return;
        const unit = btn.dataset.unit;
        setUnitButtons("heightUnitToggle", unit);
        $("#heightImperial").style.display = unit === "imperial" ? "flex" : "none";
        $("#heightMetric").style.display = unit === "metric" ? "flex" : "none";
      });
    }
    if (weightToggle) {
      weightToggle.addEventListener("click", (e) => {
        const btn = e.target.closest(".unit-btn");
        if (!btn) return;
        const unit = btn.dataset.unit;
        setUnitButtons("weightUnitToggle", unit);
        $("#weightImperial").style.display = unit === "imperial" ? "flex" : "none";
        $("#weightMetric").style.display = unit === "metric" ? "flex" : "none";
      });
    }
  }

  function toggleHealthDetail() {
    const selected = getCheckboxValues("healthGroup");
    const show = selected.includes("joint-pain") || selected.includes("cardio-concerns") || selected.includes("metabolic");
    const input = $("#healthDetail");
    if (input) input.style.display = show ? "block" : "none";
    const label = input?.closest(".form-field")?.querySelector(".form-label");
    if (label) label.style.display = show ? "block" : "none";
  }

  function toggleCycleTracking() {
    const gender = $("#gender")?.value || "";
    const card = $("#cycleTrackingCard");
    if (!card) return;

    // Hide cycle tracking card for males
    if (gender === "male") {
      card.style.display = "none";
      // Set cycle tracking to "Not applicable" for males
      const cycleSelect = $("#cycleTracking");
      if (cycleSelect) cycleSelect.value = "not-applicable";
    } else {
      // Show for female, other, or not specified
      card.style.display = "";
    }
  }

  function buildBenjiFactsFromState(setupState) {
    const parts = [];
    if (setupState.goal) parts.push(`Goal: ${GOAL_LABELS[setupState.goal] || setupState.goal}`);
    if (setupState.experience) parts.push(`Experience: ${EXPERIENCE_LABELS[setupState.experience] || setupState.experience}`);
    if (setupState.constraints && setupState.constraints.length) parts.push(`Constraints: ${setupState.constraints.join(", ")}`);
    if (setupState.health && setupState.health.length) {
      let healthStr = setupState.health.join(", ");
      if (setupState.healthDetail) healthStr += ` (${setupState.healthDetail})`;
      parts.push(`Health: ${healthStr}`);
    }
    if (setupState.gender) parts.push(`Gender: ${GENDER_LABELS[setupState.gender] || setupState.gender}`);
    if (setupState.cycleTracking) parts.push(`Cycle tracking: ${CYCLE_LABELS[setupState.cycleTracking] || setupState.cycleTracking}`);
    if (setupState.medTracking === "yes") parts.push(`Medications: ${setupState.medList || "Yes"}`);
    if (setupState.mentalReflection) parts.push(`Notes: ${setupState.mentalReflection}`);
    if (setupState.activity !== null && setupState.activity !== undefined) {
      const label = ACTIVITY_LABELS[Number(setupState.activity)] || setupState.activity;
      parts.push(`Activity: ${label}`);
    }
    if (setupState.energy) parts.push(`Energy: ${SCALE_LABELS[setupState.energy] || setupState.energy}`);
    if (setupState.sleep) parts.push(`Sleep: ${SLEEP_LABELS[setupState.sleep] || setupState.sleep}`);
    if (setupState.mood) parts.push(`Mood: ${SCALE_LABELS[setupState.mood] || setupState.mood}`);
    if (setupState.stress) parts.push(`Stress: ${SCALE_LABELS[setupState.stress] || setupState.stress}`);
    if (setupState.confidence) parts.push(`Confidence: ${CONFIDENCE_LABELS[setupState.confidence] || setupState.confidence}`);
    return parts.join(", ");
  }

  function showToast(msg, isError) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle("error", !!isError);
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  }

  async function loadProfile() {
    console.log("Loading profile for user:", userId);
    try {
      // Fetch user info (name, email) from backend
      let userName = "User";
      let userEmail = "Not available";
      let userInitials = "U";

      try {
        const userRes = await fetch(`${API_BASE}/user/${userId}`);
        if (userRes.ok) {
          const userData = await userRes.json();
          const firstName = userData.first_name || "";
          const lastName = userData.last_name || "";
          userName = (firstName + " " + lastName).trim() || "User";
          userEmail = userData.email || "Not available";
          userInitials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "U";

          // Update user info display
          $("#profileName").textContent = userName;
          $("#profileEmail").textContent = userEmail;
          $("#profileAvatar").textContent = userInitials;
        }
      } catch (err) {
        console.warn("Failed to fetch user info:", err);
      }

      // Fetch profile data from backend for this specific user
      const res = await fetch(`${API_BASE}/profileinfo/${userId}`);

      let profileData = null;
      let onboarding = {};

      if (res.ok) {
        profileData = await res.json();
        console.log("Fetched profile data from backend:", profileData);

        // Parse BenjiFacts JSON (contains summary and text)
        let parsedFacts = {};
        if (profileData.benji_facts) {
          try {
            parsedFacts = typeof profileData.benji_facts === "string"
              ? JSON.parse(profileData.benji_facts)
              : profileData.benji_facts;
          } catch (e) {
            console.warn("Failed to parse BenjiFacts:", e);
            parsedFacts = { text: profileData.benji_facts };
          }
        }

        // Extract data from parsed facts summary (format: "Goal: X | Experience: Y | ...")
        const summary = parsedFacts.summary || "";
        onboarding = parseSummaryToState(summary);
        onboarding.height = profileData.height || null;
        onboarding.weight = profileData.weight || null;
        onboarding.mentalReflection = parsedFacts.text || "";

        // Update meta display with "None" for missing values
        $("#metaHeight").textContent = profileData.height || "None";
        $("#metaWeight").textContent = profileData.weight || "None";
      } else if (res.status === 404) {
        console.log("No profile data found for user, using defaults");
        // User has no profile yet - show empty form with "None" in meta
        $("#metaHeight").textContent = "None";
        $("#metaWeight").textContent = "None";
      } else {
        throw new Error("Failed to fetch profile");
      }

      originalSetup = { ...onboarding };

      // Populate form fields with data or empty values
      setHeightFromValue(onboarding.height || "");
      setWeightFromValue(onboarding.weight || "");
      setSelect("goal", onboarding.goal);
      setSelect("experience", onboarding.experience);
      setSelect("mentalConsent", onboarding.mentalConsent);
      setSelect("gender", onboarding.gender);
      setSelect("activity", onboarding.activity !== null && onboarding.activity !== undefined ? String(onboarding.activity) : "");
      setSelect("energy", onboarding.energy ? String(onboarding.energy) : "");
      setSelect("sleep", onboarding.sleep ? String(onboarding.sleep) : "");
      setSelect("mood", onboarding.mood ? String(onboarding.mood) : "");
      setSelect("stress", onboarding.stress ? String(onboarding.stress) : "");
      setSelect("confidence", onboarding.confidence);
      setSelect("cycleTracking", onboarding.cycleTracking);
      setSelect("medTracking", onboarding.medTracking);
      setInput("medList", onboarding.medList);
      setInput("mentalReflection", onboarding.mentalReflection);
      setInput("mentalConsentNote", onboarding.mentalConsentNote);
      setInput("healthDetail", onboarding.healthDetail);

      const constraintValues = mapLabelsToValues(onboarding.constraints || [], CONSTRAINT_OPTIONS);
      const healthValues = mapLabelsToValues(onboarding.health || [], HEALTH_OPTIONS);
      setCheckboxGroup("constraintsGroup", constraintValues);
      setCheckboxGroup("healthGroup", healthValues);

      applyNoneRule("constraintsGroup", ["none-constraints"]);
      applyNoneRule("healthGroup", ["prefer-not-health", "none-health"]);
      toggleMedList();
      toggleHealthDetail();
      toggleCycleTracking();

      originalProfile = {
        height: onboarding.height || "",
        weight: onboarding.weight || "",
        benji_facts: onboarding.mentalReflection || ""
      };

      $("#profileLoading").style.display = "none";
      $("#profileContent").style.display = "block";
    } catch (err) {
      console.error("Failed to load profile:", err);
      const loading = $("#profileLoading");
      if (loading) loading.textContent = "Failed to load profile: " + err.message;
    }
  }

  // Helper function to parse summary string back to state object
  function parseSummaryToState(summary) {
    const state = {};
    if (!summary) return state;

    // Split by ", " only when followed by a field name (Capital letter + ": ")
    const parts = summary.split(/, (?=[A-Z])/);
    parts.forEach(part => {
      const [key, ...valueParts] = part.split(": ");
      const value = valueParts.join(": ");

      if (key === "Goal") {
        state.goal = Object.keys(GOAL_LABELS).find(k => GOAL_LABELS[k] === value) || null;
      } else if (key === "Experience") {
        state.experience = Object.keys(EXPERIENCE_LABELS).find(k => EXPERIENCE_LABELS[k] === value) || null;
      } else if (key === "Constraints") {
        state.constraints = value.split(", ");
      } else if (key === "Health") {
        const detailMatch = value.match(/^(.+?)\s+\((.+)\)$/);
        if (detailMatch) {
          state.health = detailMatch[1].split(", ");
          state.healthDetail = detailMatch[2];
        } else {
          state.health = value.split(", ");
        }
      } else if (key === "Gender") {
        state.gender = Object.keys(GENDER_LABELS).find(k => GENDER_LABELS[k] === value) || null;
      } else if (key === "Cycle tracking") {
        state.cycleTracking = Object.keys(CYCLE_LABELS).find(k => CYCLE_LABELS[k] === value) || null;
      } else if (key === "Medications") {
        state.medTracking = "yes";
        state.medList = value === "Yes" ? "" : value;
      } else if (key === "Notes") {
        state.mentalReflection = value;
      } else if (key === "Activity") {
        state.activity = ACTIVITY_LABELS.indexOf(value);
        if (state.activity === -1) state.activity = null;
      } else if (key === "Energy") {
        state.energy = Object.keys(SCALE_LABELS).find(k => SCALE_LABELS[k] === value) || null;
      } else if (key === "Sleep") {
        state.sleep = Object.keys(SLEEP_LABELS).find(k => SLEEP_LABELS[k] === value) || null;
      } else if (key === "Mood") {
        state.mood = Object.keys(SCALE_LABELS).find(k => SCALE_LABELS[k] === value) || null;
      } else if (key === "Stress") {
        state.stress = Object.keys(SCALE_LABELS).find(k => SCALE_LABELS[k] === value) || null;
      } else if (key === "Confidence") {
        state.confidence = Object.keys(CONFIDENCE_LABELS).find(k => CONFIDENCE_LABELS[k] === value) || null;
      }
    });

    return state;
  }

  // Backend expects BenjiFacts as valid JSON; we store as { text: "..." }
  function parseBenjiFactsForDisplay(val) {
    if (!val) return "";
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed.text === "string") return parsed.text;
      if (parsed && typeof parsed.summary === "string") return parsed.summary;
    } catch (_) {}
    return typeof val === "string" ? val : "";
  }

  function parseBenjiFactsSummary(val) {
    if (!val) return "";
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed.summary === "string") return parsed.summary;
    } catch (_) {}
    return "";
  }

  async function saveProfile() {
    const height = (() => {
      const isMetric = $("#heightMetric")?.style.display === "flex";
      if (isMetric) {
        const cm = $("#heightCm").value.trim();
        return cm ? `${cm} cm` : "";
      }
      const ft = $("#heightFt").value.trim();
      const inch = $("#heightIn").value.trim();
      return (ft || inch) ? `${ft || "0"} ft ${inch || "0"} in` : "";
    })();
    const weight = (() => {
      const isMetric = $("#weightMetric")?.style.display === "flex";
      if (isMetric) {
        const kg = $("#weightKg").value.trim();
        return kg ? `${kg} kg` : "";
      }
      const lb = $("#weightLb").value.trim();
      return lb ? `${lb} lb` : "";
    })();
    const setupState = {
      goal: $("#goal").value || null,
      experience: $("#experience").value || null,
      mentalConsent: $("#mentalConsent").value || null,
      mood: $("#mood").value ? Number($("#mood").value) : null,
      stress: $("#stress").value ? Number($("#stress").value) : null,
      mentalReflection: $("#mentalReflection").value.trim() || null,
      mentalConsentNote: $("#mentalConsentNote").value.trim() || null,
      height: height || null,
      heightUnit: $("#heightMetric")?.style.display === "flex" ? "metric" : "imperial",
      weight: weight || null,
      weightUnit: $("#weightMetric")?.style.display === "flex" ? "metric" : "imperial",
      weightSkipped: !weight,
      activity: $("#activity").value !== "" ? Number($("#activity").value) : null,
      energy: $("#energy").value ? Number($("#energy").value) : null,
      sleep: $("#sleep").value ? Number($("#sleep").value) : null,
      constraints: mapValuesToLabels(getCheckboxValues("constraintsGroup"), CONSTRAINT_OPTIONS),
      health: mapValuesToLabels(getCheckboxValues("healthGroup"), HEALTH_OPTIONS),
      confidence: $("#confidence").value || null,
      gender: $("#gender").value || null,
      cycleTracking: $("#cycleTracking").value || null,
      medTracking: $("#medTracking").value || null,
      medList: $("#medList").value.trim() || null,
      healthDetail: $("#healthDetail").value.trim() || null,
      activityTouched: $("#activity").value !== "",
      constraintsTouched: getCheckboxValues("constraintsGroup").length > 0,
      healthTouched: getCheckboxValues("healthGroup").length > 0
    };

    // Save to user-specific localStorage key to avoid conflicts between users
    localStorage.setItem(`userProfile_${userId}`, JSON.stringify(setupState));

    // Build the summary from current state
    const summary = buildBenjiFactsFromState(setupState);

    // Prepare payload for backend (expects height, weight, benji_facts - lowercase)
    const payload = {};
    if (height) payload.height = height;
    if (weight) payload.weight = weight;
    if (summary) {
      payload.benji_facts = JSON.stringify({ summary: summary, text: "" });
    }

    if (!Object.keys(payload).length) {
      showToast("Nothing to save.", true);
      return;
    }

    console.log("Saving profile for user:", userId, payload);

    try {
      let res = await fetch(`${API_BASE}/profileinfo/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.status === 404) {
        console.log("Profile not found, creating new profile");
        res = await fetch(`${API_BASE}/profileinfo/${userId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Save failed");
      }

      const saved = await res.json();
      console.log("Profile saved successfully:", saved);

      // Update meta display with "None" for missing values
      $("#metaHeight").textContent = saved.height || "None";
      $("#metaWeight").textContent = saved.weight || "None";

      originalProfile = {
        height: saved.height || "",
        weight: saved.weight || "",
        benji_facts: parseBenjiFactsForDisplay(saved.benji_facts) || ""
      };
      originalSetup = { ...setupState };
      showToast("Profile saved!");
    } catch (err) {
      console.error("Save failed:", err);
      showToast(err.message || "Failed to save.", true);
    }
  }

  function resetForm() {
    setHeightFromValue(originalProfile.height);
    setWeightFromValue(originalProfile.weight);

    setSelect("goal", originalSetup.goal);
    setSelect("experience", originalSetup.experience);
    setSelect("mentalConsent", originalSetup.mentalConsent);
    setSelect("gender", originalSetup.gender);
    setSelect("activity", originalSetup.activity !== null && originalSetup.activity !== undefined ? String(originalSetup.activity) : "");
    setSelect("energy", originalSetup.energy ? String(originalSetup.energy) : "");
    setSelect("sleep", originalSetup.sleep ? String(originalSetup.sleep) : "");
    setSelect("mood", originalSetup.mood ? String(originalSetup.mood) : "");
    setSelect("stress", originalSetup.stress ? String(originalSetup.stress) : "");
    setSelect("confidence", originalSetup.confidence);
    setSelect("cycleTracking", originalSetup.cycleTracking);
    setSelect("medTracking", originalSetup.medTracking);
    setInput("medList", originalSetup.medList);
    setInput("mentalReflection", originalSetup.mentalReflection);
    setInput("mentalConsentNote", originalSetup.mentalConsentNote);
    setInput("healthDetail", originalSetup.healthDetail);

    const constraintValues = mapLabelsToValues(originalSetup.constraints || [], CONSTRAINT_OPTIONS);
    const healthValues = mapLabelsToValues(originalSetup.health || [], HEALTH_OPTIONS);
    setCheckboxGroup("constraintsGroup", constraintValues);
    setCheckboxGroup("healthGroup", healthValues);
    applyNoneRule("constraintsGroup", ["none-constraints"]);
    applyNoneRule("healthGroup", ["prefer-not-health", "none-health"]);
    toggleMedList();
    toggleHealthDetail();
    toggleCycleTracking();
  }

  $("#saveBtn")?.addEventListener("click", saveProfile);
  $("#resetBtn")?.addEventListener("click", resetForm);
  $("#medTracking")?.addEventListener("change", toggleMedList);
  $("#healthGroup")?.addEventListener("change", toggleHealthDetail);
  $("#gender")?.addEventListener("change", toggleCycleTracking);
  bindNoneRule("constraintsGroup", ["none-constraints"]);
  bindNoneRule("healthGroup", ["prefer-not-health", "none-health"]);
  bindUnitToggles();

  // Validate inches are 0-11
  const heightInInput = $("#heightIn");
  if (heightInInput) {
    heightInInput.addEventListener("input", function() {
      const val = parseInt(this.value);
      if (!isNaN(val) && (val < 0 || val > 11)) {
        this.value = Math.min(11, Math.max(0, val));
      }
    });
  }

  loadProfile();
})();
