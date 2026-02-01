// auth.js — handles tab switching + login + signup for landing.html
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const API_BASE = "http://localhost:8000";
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

  const overlay = $("#loadingOverlay");
  const loadingText = $("#loadingText");

  const setOverlay = (on, msg) => {
    if (msg) loadingText.textContent = msg;
    overlay.classList.toggle("active", on);
  };

  const setErr = (el, visible) => {
    if (el) el.classList.toggle("visible", visible);
  };

  // ── tab switching ──
  const tabs = $$(".auth-tab");
  const panels = {
    login: $("#panel-login"),
    signup: $("#panel-signup"),
  };

  function switchMode(mode) {
    tabs.forEach((t) => {
      const active = t.dataset.mode === mode;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", active);
    });
    Object.keys(panels).forEach((k) => {
      panels[k].classList.toggle("active", k === mode);
    });
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => switchMode(tab.dataset.mode)));

  // ── eye toggles ──
  function wireEye(btnSel, inputSel, slashSel) {
    const btn = $(btnSel);
    const inp = $(inputSel);
    const slash = $(slashSel);
    if (!btn || !inp) return;

    btn.addEventListener("click", () => {
      const hidden = inp.type === "password";
      inp.type = hidden ? "text" : "password";
      if (slash) slash.style.display = hidden ? "block" : "none";
      btn.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
    });
  }

  wireEye("#login-togglePw", "#login-password", "#login-eyeSlash");
  wireEye("#signup-togglePw", "#signup-password", "#signup-eyeSlash");

  // ─────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────
  // LOGIN submit
document.querySelector('#loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = (document.querySelector('#login-email').value || '').trim();
  const pwd = (document.querySelector('#login-password').value || '').trim();

  const response = await fetch("http://localhost:8000/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pwd })   // ✅ FIX
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    alert(data.detail || "Login failed");
    return;
  }

  const remember = document.querySelector('#login-rememberMe').checked;

  const session = {
    user_id: data.user_id,
    email,
    loggedIn: true,
    remember,
    timestamp: new Date().toISOString()
  };

  // keep your existing key if you already use it
  const key = 'sanctuary_session';
  if (remember) {
    localStorage.setItem(key, JSON.stringify(session));
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, JSON.stringify(session));
    localStorage.removeItem(key);
  }

  window.location.href = './index.html';
});


  // ─────────────────────────────────────────
  // SIGNUP
  // ─────────────────────────────────────────
  // SIGNUP submit
    document.querySelector('#signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = (document.querySelector('#signup-firstName').value || '').trim();
    const lastName  = (document.querySelector('#signup-lastName').value || '').trim();
    const email     = (document.querySelector('#signup-email').value || '').trim();
    const pwd       = (document.querySelector('#signup-password').value || '').trim();
    const confirm   = (document.querySelector('#signup-confirm').value || '').trim();
    const agree     = !!document.querySelector('#signup-agree').checked;

    if (!firstName || !lastName) { alert("Both names are required"); return; }
    if (!validEmail(email)) { alert("Please enter a valid email address"); return; }
    if (pwd.length < 8) { alert("Password must be at least 8 characters"); return; }
    if (pwd !== confirm) { alert("Passwords do not match"); return; }
    if (!agree) { alert("Please accept Terms & Privacy"); return; }

    const response = await fetch("http://localhost:8000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        password: pwd
        }) // ✅ FIX
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        alert(data.detail || "Signup failed");
        return;
    }

    // optional: auto login
    localStorage.setItem('sanctuary_session', JSON.stringify({
        user_id: data.user_id,
        email,
        loggedIn: true,
        timestamp: new Date().toISOString()
    }));

    window.location.href = './setup.html';
    });

})();
