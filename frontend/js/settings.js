(function () {
  const $ = (s) => document.querySelector(s);
  const show = (el) => { if (el) el.style.display = "block"; };
  const hide = (el) => { if (el) el.style.display = "none"; };

  // --- session helper ---
  function getSession() {
    const s1 = localStorage.getItem("sanctuary_session");
    if (s1) return { where: "localStorage", value: JSON.parse(s1) };
    const s2 = sessionStorage.getItem("sanctuary_session");
    if (s2) return { where: "sessionStorage", value: JSON.parse(s2) };
    return null;
  }

  const session = getSession();
  const signedInAs = $("#signedInAs");
  const sessionType = $("#sessionType");
  const sessionHint = $("#sessionHint");

  if (!session || !session.value?.loggedIn) {
    // DEV FALLBACK: create a session so settings can load
    const devSession = {
      email: "dev@sanctuary.local",
      loggedIn: true,
      remember: true,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem("sanctuary_session", JSON.stringify(devSession));
  }


  signedInAs.textContent = session.value.email || "Unknown";
  sessionType.textContent = session.where === "localStorage" ? "Remembered session" : "Session-only";
  sessionHint.textContent = "Manage your profile and preferences.";

  // --- logout ---
  $("#logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("sanctuary_session");
    sessionStorage.removeItem("sanctuary_session");
    window.location.href = "./login.html";
  });

  // --- mental health consent gating ---
  let mhConsent = false;
  const mhBox = $("#mhBox");
  const mhYes = $("#mhYes");
  const mhNo = $("#mhNo");

  function setMH(on) {
    mhConsent = on;
    mhYes.classList.toggle("active", on);
    mhNo.classList.toggle("active", !on);
    mhBox.style.display = on ? "block" : "none";
    if (!on) $("#mhDx").value = "";
  }

  mhYes?.addEventListener("click", () => setMH(true));
  mhNo?.addEventListener("click", () => setMH(false));

  // --- BMI calc (simple parser for lb/kg + cm/ft'in) ---
  function parseWeightToKg(str) {
    const s = (str || "").trim().toLowerCase();
    if (!s) return null;

    // kg
    const kgMatch = s.match(/([\d.]+)\s*kg/);
    if (kgMatch) return Number(kgMatch[1]);

    // lb
    const lbMatch = s.match(/([\d.]+)\s*lb/);
    if (lbMatch) return Number(lbMatch[1]) * 0.45359237;

    // plain number assume lb (since you're US-based)
    const num = Number(s);
    if (!Number.isNaN(num) && num > 0) return num * 0.45359237;

    return null;
  }

  function parseHeightToM(str) {
    const s = (str || "").trim().toLowerCase();
    if (!s) return null;

    // cm
    const cmMatch = s.match(/([\d.]+)\s*cm/);
    if (cmMatch) return Number(cmMatch[1]) / 100;

    // meters
    const mMatch = s.match(/([\d.]+)\s*m/);
    if (mMatch) return Number(mMatch[1]);

    // feet'inches e.g. 5'0" or 5' 0
    const ftInMatch = s.match(/(\d+)\s*'\s*(\d+)?/);
    if (ftInMatch) {
      const ft = Number(ftInMatch[1]);
      const inch = Number(ftInMatch[2] || 0);
      const totalIn = ft * 12 + inch;
      return totalIn * 0.0254;
    }

    // plain number assume inches? too ambiguous, skip
    return null;
  }

  function updateBMI() {
    const wKg = parseWeightToKg($("#weight").value);
    const hM = parseHeightToM($("#height").value);

    const out = $("#bmiValue");
    if (!wKg || !hM) { out.textContent = "—"; return; }

    const bmi = wKg / (hM * hM);
    out.textContent = bmi.toFixed(1);
  }

  $("#height")?.addEventListener("input", updateBMI);
  $("#weight")?.addEventListener("input", updateBMI);

  // --- load/save profile ---
  const PROFILE_KEY = "sanctuary_profile";

  const fields = [
    "name","gender","height","weight","busyness","routine","accountability","diet",
    "cardio","cardioExp","muscleMass","strengthExp","workoutFreq","injuryHistory",
    "fitnessDesc","sleepQuality","sleepDuration","emotionalStability","mhDx"
  ];

  function getProfileFromForm() {
    const profile = {};
    fields.forEach(id => profile[id] = ($("#" + id)?.value || "").trim());

    profile.lifestyle = {
      caffeine: !!$("#caffeine")?.checked,
      alcohol: !!$("#alcohol")?.checked
    };

    profile.mentalHealthConsent = mhConsent;

    // include computed bmi if available
    profile.bmi = $("#bmiValue")?.textContent || "—";

    profile.updatedAt = new Date().toISOString();
    return profile;
  }

  function setFormFromProfile(p) {
    fields.forEach(id => {
      if ($("#" + id)) $("#" + id).value = p?.[id] ?? "";
    });

    $("#caffeine").checked = !!p?.lifestyle?.caffeine;
    $("#alcohol").checked = !!p?.lifestyle?.alcohol;

    setMH(!!p?.mentalHealthConsent);
    updateBMI();
  }

  const saveMsg = $("#saveMsg");

  $("#saveProfile")?.addEventListener("click", () => {
    const profile = getProfileFromForm();
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    hide(saveMsg);
    show(saveMsg);
    setTimeout(() => hide(saveMsg), 1500);
  });

  $("#resetProfile")?.addEventListener("click", () => {
    fields.forEach(id => { if ($("#" + id)) $("#" + id).value = ""; });
    $("#caffeine").checked = false;
    $("#alcohol").checked = false;
    setMH(false);
    updateBMI();
    hide(saveMsg);
  });

  // load existing profile if any
  const existing = localStorage.getItem(PROFILE_KEY);
  if (existing) {
    try { setFormFromProfile(JSON.parse(existing)); } catch (_) {}
  } else {
    // prefill email-based name if exists
    const user = localStorage.getItem("sanctuary_user");
    if (user) {
      try {
        const u = JSON.parse(user);
        if (u?.name) $("#name").value = u.name;
      } catch (_) {}
    }
  }

  // --- password placeholder ---
  const pwMsg = $("#pwMsg");
  $("#savePassword")?.addEventListener("click", () => {
    const pw = ($("#newPassword")?.value || "").trim();
    if (!pw || pw.length < 8) {
      // simple feedback using existing color
      pwMsg.textContent = "Use 8+ characters.";
      pwMsg.style.color = "var(--terracotta)";
      show(pwMsg);
      setTimeout(() => hide(pwMsg), 1600);
      return;
    }
    localStorage.setItem("sanctuary_password_placeholder", pw);
    $("#newPassword").value = "";
    pwMsg.textContent = "Updated. ✅";
    pwMsg.style.color = "var(--sage-dark)";
    show(pwMsg);
    setTimeout(() => hide(pwMsg), 1400);
  });
})();
