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
  if (!session || !session.loggedIn || !session.user_id) {
    window.location.href = "./landing.html";
    return;
  }

  const userId = session.user_id;
  let originalProfile = { height: "", weight: "", benji_facts: "" };

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
      const [userRes, profileRes] = await Promise.allSettled([
        fetch(`${API_BASE}/user/${userId}`),
        fetch(`${API_BASE}/profileinfo/${userId}`)
      ]);

      if (userRes.status === "fulfilled" && userRes.value.ok) {
        const user = await userRes.value.json();
        const first = user.first_name || "";
        const last = user.last_name || "";
        const initials = (first.charAt(0) + last.charAt(0)).toUpperCase() || "--";
        $("#firstName").value = first;
        $("#lastName").value = last;
        $("#email").value = user.email || "";
        $("#avatarInitials").textContent = initials;
        $("#displayName").textContent = `${first} ${last}`.trim() || "User";
        $("#displayEmail").textContent = user.email || "";
      }

      if (profileRes.status === "fulfilled" && profileRes.value.ok) {
        const profile = await profileRes.value.json();
        $("#height").value = profile.height || "";
        $("#weight").value = profile.weight || "";
        // BenjiFacts may be stored as JSON string { "text": "..." } or plain string
        $("#benjiFacts").value = parseBenjiFactsForDisplay(profile.benji_facts) || "";
        $("#metaHeight").textContent = profile.height || "--";
        $("#metaWeight").textContent = profile.weight || "--";
        originalProfile = {
          height: profile.height || "",
          weight: profile.weight || "",
          benji_facts: parseBenjiFactsForDisplay(profile.benji_facts) || ""
        };
      } else {
        const onboardingRaw = localStorage.getItem("userProfile");
        if (onboardingRaw) {
          try {
            const onboarding = JSON.parse(onboardingRaw) || {};
            $("#height").value = onboarding.height || "";
            $("#weight").value = onboarding.weight || "";
            $("#benjiFacts").value = onboarding.mentalReflection || "";
            $("#metaHeight").textContent = onboarding.height || "--";
            $("#metaWeight").textContent = onboarding.weight || "--";
            originalProfile = {
              height: onboarding.height || "",
              weight: onboarding.weight || "",
              benji_facts: onboarding.mentalReflection || ""
            };
          } catch (_) {}
        }
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

  async function saveProfile() {
    const height = $("#height").value.trim();
    const weight = $("#weight").value.trim();
    const benjiFacts = $("#benjiFacts").value.trim();

    // Backend expects { profile: { Height?, Weight?, BenjiFacts? } } (PascalCase)
    const profileFields = {};
    if (height) profileFields.Height = height;
    if (weight) profileFields.Weight = weight;
    if (benjiFacts) profileFields.BenjiFacts = JSON.stringify({ text: benjiFacts });

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
        benji_facts: saved.benji_facts || ""
      };
      showToast("Profile saved!");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to save.", true);
    }
  }

  function resetForm() {
    $("#height").value = originalProfile.height;
    $("#weight").value = originalProfile.weight;
    $("#benjiFacts").value = originalProfile.benji_facts;
  }

  $("#saveBtn")?.addEventListener("click", saveProfile);
  $("#resetBtn")?.addEventListener("click", resetForm);

  loadProfile();
})();
