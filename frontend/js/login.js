(function () {
  const $ = (sel) => document.querySelector(sel);

  const form = $("#loginForm");
  const emailEl = $("#email");
  const passEl = $("#password");
  const emailError = $("#emailError");
  const passError = $("#passwordError");
  const toggleBtn = $("#togglePassword");
  const eyeSlash = $("#eyeSlash");
  const overlay = $("#loadingOverlay");
  const goSignup = $("#goSignup");

  const show = (el) => { if (el) el.style.display = "block"; };
  const hide = (el) => { if (el) el.style.display = "none"; };

  const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  toggleBtn?.addEventListener("click", () => {
    const isHidden = passEl.type === "password";
    passEl.type = isHidden ? "text" : "password";
    // show slash when password is visible
    if (eyeSlash) eyeSlash.style.display = isHidden ? "block" : "none";
    toggleBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  });

  goSignup?.addEventListener("click", () => {
    window.location.href = "../html/signup.html";
  });

  const setOverlay = (on) => {
    if (!overlay) return;
    overlay.classList.toggle("active", on);
  };

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    hide(emailError);
    hide(passError);

    const email = (emailEl?.value || "").trim();
    const pwd = (passEl?.value || "").trim();

    let ok = true;
    if (!validEmail(email)) { show(emailError); ok = false; }
    if (!pwd) { show(passError); ok = false; }
    if (!ok) return;

    setOverlay(true);
    try {
      // UI-only "login": store session + go to index.html
      await new Promise(r => setTimeout(r, 400));

      const remember = $("#rememberMe")?.checked ?? false;
      const session = {
        email,
        loggedIn: true,
        remember,
        timestamp: new Date().toISOString()
      };

      if (remember) {
        localStorage.setItem("sanctuary_session", JSON.stringify(session));
        sessionStorage.removeItem("sanctuary_session");
      } else {
        sessionStorage.setItem("sanctuary_session", JSON.stringify(session));
        localStorage.removeItem("sanctuary_session");
      }

      window.location.href = "../html/index.html";
    } finally {
      setOverlay(false);
    }
  });
})();
