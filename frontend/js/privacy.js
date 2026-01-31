(function () {
  const $ = (s) => document.querySelector(s);
  const msg = $("#clearedMsg");

  const show = () => { if (msg) msg.style.display = "block"; };
  const hide = () => { if (msg) msg.style.display = "none"; };

  $("#clearLocal")?.addEventListener("click", () => {
    hide();
    localStorage.clear();
    show();
  });

  $("#clearSession")?.addEventListener("click", () => {
    hide();
    sessionStorage.clear();
    show();
  });
})();
