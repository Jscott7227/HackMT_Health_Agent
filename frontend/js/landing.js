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
  wireEye("#signup-confirmToggle", "#signup-confirm", "#signup-confirmSlash");

  // ─────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────
  // LOGIN submit
document.querySelector('#loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const emailEl = document.querySelector('#login-email');
  const passEl = document.querySelector('#login-password');
  const emailErr = document.querySelector('#login-emailError');
  const passErr = document.querySelector('#login-passwordError');

  setErr(emailErr, false);
  setErr(passErr, false);

  const email = (emailEl.value || '').trim();
  const pwd = (passEl.value || '').trim();

  let ok = true;
  if (!validEmail(email)) {
    emailErr.textContent = "Please enter a valid email address.";
    setErr(emailErr, true);
    ok = false;
  }
  if (!pwd) {
    passErr.textContent = "Password cannot be empty.";
    setErr(passErr, true);
    ok = false;
  }
  if (!ok) return;

  let response;
  try {
    response = await fetch("http://localhost:8000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pwd })
    });
  } catch (_) {
    passErr.textContent = "Server connection failed.";
    setErr(passErr, true);
    return;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    passErr.textContent = data.detail || "Invalid email or password.";
    setErr(passErr, true);
    return;
  }

  const session = {
    user_id: data.user_id,
    email,
    loggedIn: true,
    remember: true,
    timestamp: new Date().toISOString()
  };

  localStorage.setItem('sanctuary_session', JSON.stringify(session));
  sessionStorage.removeItem('sanctuary_session');

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

    const nameErr = document.querySelector('#signup-nameError');
    const emailErr = document.querySelector('#signup-emailError');
    const passErr = document.querySelector('#signup-passwordError');
    const confirmErr = document.querySelector('#signup-confirmError');
    const agreeErr = document.querySelector('#signup-agreeError');

    [nameErr, emailErr, passErr, confirmErr, agreeErr].forEach((el) => setErr(el, false));

    let ok = true;
    if (!firstName || !lastName) {
      nameErr.textContent = !firstName && !lastName ? "First and last name are required."
        : !firstName ? "First name is required." : "Last name is required.";
      setErr(nameErr, true);
      ok = false;
    }
    if (!validEmail(email)) {
      emailErr.textContent = "Please enter a valid email address.";
      setErr(emailErr, true);
      ok = false;
    }
    if (pwd.length < 8) {
      passErr.textContent = "Password must be at least 8 characters.";
      setErr(passErr, true);
      ok = false;
    }
    if (pwd !== confirm || !confirm) {
      confirmErr.textContent = "Passwords do not match.";
      setErr(confirmErr, true);
      ok = false;
    }
    if (!agree) {
      setErr(agreeErr, true);
      ok = false;
    }
    if (!ok) return;

    let response;
    try {
      response = await fetch("http://localhost:8000/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password: pwd
          })
      });
    } catch (_) {
      emailErr.textContent = "Server connection failed.";
      setErr(emailErr, true);
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const msg = data.detail || "Signup failed";
        if (msg.toLowerCase().includes("email")) {
          emailErr.textContent = msg;
          setErr(emailErr, true);
        } else {
          passErr.textContent = msg;
          setErr(passErr, true);
        }
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
