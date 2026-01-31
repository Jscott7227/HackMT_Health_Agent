(function () {
  const $ = (s) => document.querySelector(s);
  const form = $("#resetForm");
  const emailEl = $("#email");
  const emailError = $("#emailError");
  const successMsg = $("#successMsg");
  const backLogin = $("#backLogin");

  const show = (el) => { if (el) el.style.display = "block"; };
  const hide = (el) => { if (el) el.style.display = "none"; };
  const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  backLogin?.addEventListener("click", () => window.location.href = "./login.html");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hide(emailError);
    hide(successMsg);

    const email = (emailEl?.value || "").trim();
    if (!validEmail(email)) { show(emailError); return; }

    // Prototype behavior
    await new Promise(r => setTimeout(r, 350));
    show(successMsg);
  });
})();
