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
  const hasSetupData = !!localStorage.getItem("userProfile");
  if (!session && !hasSetupData) {
    const loading = $("#profileLoading");
    if (loading) loading.textContent = "No setup data yet. Please complete setup first.";
    return;
  }
  let originalProfile = { height: "", weight: "", benji_facts: "" };
  let originalSetup = {};

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
    return parts.join(" | ");
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
    try {
      const onboardingRaw = localStorage.getItem("userProfile");
      if (onboardingRaw) {
        const onboarding = JSON.parse(onboardingRaw) || {};
        originalSetup = { ...onboarding };

        setHeightFromValue(onboarding.height || "");
        setWeightFromValue(onboarding.weight || "");
        $("#benjiFacts").value = onboarding.mentalReflection || "";

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

        const builtSummary = buildBenjiFactsFromState(onboarding);
        if ($("#setupSummary")) $("#setupSummary").textContent = builtSummary || "--";

        originalProfile = {
          height: onboarding.height || "",
          weight: onboarding.weight || "",
          benji_facts: onboarding.mentalReflection || ""
        };
      } else {
        toggleMedList();
        toggleHealthDetail();
      }

      $("#profileLoading").style.display = "none";
      $("#profileContent").style.display = "block";
    } catch (err) {
      console.error("Failed to load profile:", err);
      const loading = $("#profileLoading");
      if (loading) loading.textContent = "Failed to load profile.";
    }
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
    const benjiFacts = $("#benjiFacts").value.trim();

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

    localStorage.setItem("userProfile", JSON.stringify(setupState));

    // Backend expects { profile: { Height?, Weight?, BenjiFacts? } } (PascalCase)
    const profileFields = {};
    if (height) profileFields.Height = height;
    if (weight) profileFields.Weight = weight;
    const summary = buildBenjiFactsFromState(setupState);
    if ($("#setupSummary")) $("#setupSummary").textContent = summary || "--";
    if (summary || benjiFacts) {
      profileFields.BenjiFacts = JSON.stringify({ summary: summary || "", text: benjiFacts || "" });
    }

    if (!Object.keys(profileFields).length) {
      showToast("Nothing to save.", true);
      return;
    }

    const body = { profile: profileFields };

    try {
      let res = await fetch(`${API_BASE}/profileinfo/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.status === 404) {
        res = await fetch(`${API_BASE}/profileinfo/${userId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Save failed");
      }

      const saved = await res.json();
      $("#metaHeight").textContent = saved.height || "--";
      $("#metaWeight").textContent = saved.weight || "--";
      originalProfile = {
        height: saved.height || "",
        weight: saved.weight || "",
        benji_facts: parseBenjiFactsForDisplay(saved.benji_facts) || ""
      };
      originalSetup = { ...setupState };
      showToast("Profile saved!");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to save.", true);
    }
  }

  function resetForm() {
    setHeightFromValue(originalProfile.height);
    setWeightFromValue(originalProfile.weight);
    $("#benjiFacts").value = originalProfile.benji_facts;

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
    const builtSummary = buildBenjiFactsFromState(originalSetup || {});
    if ($("#setupSummary")) $("#setupSummary").textContent = builtSummary || "--";
  }

  $("#saveBtn")?.addEventListener("click", saveProfile);
  $("#resetBtn")?.addEventListener("click", resetForm);
  $("#medTracking")?.addEventListener("change", toggleMedList);
  $("#healthGroup")?.addEventListener("change", toggleHealthDetail);
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
