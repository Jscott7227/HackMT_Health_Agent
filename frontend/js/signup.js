(function () {
  const $ = (sel) => document.querySelector(sel);

  const form = $("#signupForm");
  const nameEl = $("#name");
  const emailEl = $("#email");
  const passEl = $("#password");
  const agreeEl = $("#agree");

  const nameError = $("#nameError");
  const emailError = $("#emailError");
  const passwordError = $("#passwordError");
  const agreeError = $("#agreeError");

  const toggleBtn = $("#togglePassword");
  const eyeSlash = $("#eyeSlash");
  const overlay = $("#loadingOverlay");
  const goLogin = $("#goLogin");

  const show = (el) => { if (el) el.style.display = "block"; };
  const hide = (el) => { if (el) el.style.display = "none"; };

  const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  toggleBtn?.addEventListener("click", () => {
    const isHidden = passEl.type === "password";
    passEl.type = isHidden ? "text" : "password";
    if (eyeSlash) eyeSlash.style.display = isHidden ? "block" : "none";
    toggleBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  });

  goLogin?.addEventListener("click", () => {
    window.location.href = "./landing.html";
  });

  const setOverlay = (on) => {
    if (!overlay) return;
    overlay.classList.toggle("active", on);
  };

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    [nameError, emailError, passwordError, agreeError].forEach(hide);

    const name = (nameEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const pwd = (passEl?.value || "").trim();
    const agree = !!agreeEl?.checked;

    let ok = true;
    if (!name) { show(nameError); ok = false; }
    if (!validEmail(email)) { show(emailError); ok = false; }
    if (pwd.length < 8) { show(passwordError); ok = false; }
    if (!agree) { show(agreeError); ok = false; }
    if (!ok) return;

    setOverlay(true);
    try {
      await new Promise(r => setTimeout(r, 450));

      const user = { name, email, createdAt: new Date().toISOString() };
      localStorage.setItem("sanctuary_user", JSON.stringify(user));

      // Log them in immediately (prototype)
      const session = { email, loggedIn: true, remember: true, timestamp: new Date().toISOString() };
      localStorage.setItem("sanctuary_session", JSON.stringify(session));
      sessionStorage.removeItem("sanctuary_session");

      window.location.href = "./index.html";
    } finally {
      setOverlay(false);
    }
  });
})();
