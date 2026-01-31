(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Tabs in order
  const domains = ["day", "fitness", "wellness"];
  let currentIndex = 0;

  // Elements
  const tabs = $$("#checkinTabs .nav-tab");
  const sections = domains.map(d => $(`#domain-${d}`));
  const prevBtn = $("#prevDomain");
  const nextBtn = $("#nextDomain");
  const submitBtn = $("#submitCheckin");
  const progressText = $("#progressText");
  const progressFill = $("#progressFill");
  const loading = $("#loadingOverlay");

  // Slider readouts
  const sliderReadouts = [
    ["#dayScore", "#dayScoreValue"],
    ["#fitnessScore", "#fitnessScoreValue"],
    ["#wellnessScore", "#wellnessScoreValue"],
    ["#stressScore", "#stressScoreValue"],
    ["#sleepScore", "#sleepScoreValue"],
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

  // Button groups (single-select)
  const setExclusiveActive = (group, value) => {
    const btns = $$(`button[data-group="${group}"]`);
    btns.forEach(b => b.classList.toggle("active", b.dataset.value === value));
  };

  const getExclusiveValue = (group) => {
    const active = $(`button[data-group="${group}"].active`);
    return active ? active.dataset.value : null;
  };

  // Domain switching
  const setDomain = (index) => {
    currentIndex = Math.max(0, Math.min(domains.length - 1, index));

    // sections
    sections.forEach((sec, i) => {
      if (!sec) return;
      sec.classList.toggle("active", i === currentIndex);
    });

    // tabs
    tabs.forEach((t) => {
      const isActive = t.dataset.domain === domains[currentIndex];
      t.classList.toggle("active", isActive);
    });

    // progress
    const label =
      currentIndex === 0 ? "Overall Day" :
      currentIndex === 1 ? "Fitness" :
      "Wellness";

    if (progressText) progressText.textContent = label;
    if (progressFill) {
      const pct = ((currentIndex + 1) / domains.length) * 100;
      progressFill.style.width = `${pct}%`;
    }

    // nav buttons
    if (prevBtn) prevBtn.disabled = currentIndex === 0;

    const isLast = currentIndex === domains.length - 1;
    if (nextBtn) nextBtn.style.display = isLast ? "none" : "inline-flex";
    if (submitBtn) submitBtn.style.display = isLast ? "inline-flex" : "none";
  };

  // Build payload
  const getTags = () =>
    $$('input[name="tags"]:checked').map(i => i.value);

  const payload = () => ({
    dayScore: Number($("#dayScore")?.value ?? 0),
    dayNotes: ($("#dayNotes")?.value ?? "").trim(),
    tags: getTags(),

    fitnessScore: Number($("#fitnessScore")?.value ?? 0),
    fitnessNotes: ($("#fitnessNotes")?.value ?? "").trim(),
    overallWellness: Number($("#wellnessScore")?.value ?? 0),

    wellnessNotes: ($("#wellnessNotes")?.value ?? "").trim(),
    stress: Number($("#stressScore")?.value ?? 0),
    mood: Number(getExclusiveValue("mood") ?? 0),

    ate: getExclusiveValue("ate") === "yes",
    water: getExclusiveValue("water") === "yes",
    sleep: Number($("#sleepScore")?.value ?? 0),

    timestamp: new Date().toISOString(),
  });

  // Wire clicks
  document.addEventListener("click", (e) => {
    // tab click
    const tab = e.target.closest(".nav-tab");
    if (tab && tab.dataset.domain) {
      const idx = domains.indexOf(tab.dataset.domain);
      if (idx !== -1) setDomain(idx);
      return;
    }

    // option-btn + emoji-btn groups
    const groupBtn = e.target.closest("button.option-btn, button.emoji-btn");
    if (groupBtn && groupBtn.dataset.group && groupBtn.dataset.value) {
      setExclusiveActive(groupBtn.dataset.group, groupBtn.dataset.value);
      return;
    }
  });

  // Next / Prev
  prevBtn?.addEventListener("click", () => setDomain(currentIndex - 1));
  nextBtn?.addEventListener("click", () => setDomain(currentIndex + 1));

  // Submit
  submitBtn?.addEventListener("click", async () => {
    const data = payload();

    // minimal guardrails
    if (data.dayScore < 1 || data.dayScore > 10) {
      alert("Day score must be between 1 and 10.");
      setDomain(0);
      return;
    }
    if (data.fitnessScore < 1 || data.fitnessScore > 5) {
      alert("Fitness score must be between 1 and 5.");
      setDomain(1);
      return;
    }
    if (data.overallWellness < 1 || data.overallWellness > 5) {
      alert("Wellness score must be between 1 and 5.");
      setDomain(1);
      return;
    }

    try {
      if (loading) loading.style.display = "flex";

      // Prefer your existing storage layer
      if (window.StorageAPI?.saveCheckin) {
        await window.StorageAPI.saveCheckin(data);
      } else {
        // fallback localStorage
        const key = "Benji_checkins";
        const arr = JSON.parse(localStorage.getItem(key) || "[]");
        arr.push(data);
        localStorage.setItem(key, JSON.stringify(arr));
      }

      const agentMsg = $("#agentMessage");
      if (agentMsg) {
        agentMsg.innerHTML = `<p>Saved ✨ Want to do anything with your data tonight?</p>`;
      }

      // optional: reset
      // location.reload();
    } catch (err) {
      console.error(err);
      alert("Couldn’t save check-in. Check console for details.");
    } finally {
      if (loading) loading.style.display = "none";
    }
  });

  // init
  initReadouts();
  setDomain(0);
})();
